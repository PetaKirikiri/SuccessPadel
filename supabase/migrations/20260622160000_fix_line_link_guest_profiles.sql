-- LINE link QR: unique per padel_player, never expires, allow members without LINE yet.

update public.player_line_link_requests
set expires_at = 'infinity'::timestamptz
where used_at is null;

update public.player_line_handoff_tokens
set expires_at = 'infinity'::timestamptz
where used_at is null;

create or replace function public.create_player_line_link_request(
  p_competition_id uuid,
  p_padel_player_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_token text;
  v_player public.padel_players%rowtype;
  v_profile_line text;
begin
  select * into v_player
  from public.padel_players
  where id = p_padel_player_id;

  if not found then
    raise exception 'Player not found';
  end if;

  if v_player.line_user_id is not null and btrim(v_player.line_user_id) <> '' then
    raise exception 'Player already linked';
  end if;

  if v_player.profile_id is not null then
    select p.line_user_id into v_profile_line
    from public.profiles p
    where p.id = v_player.profile_id;

    if v_profile_line is not null and btrim(v_profile_line) <> '' then
      raise exception 'Player already linked';
    end if;
  end if;

  if p_competition_id is not null then
    if not exists (
      select 1
      from public.game_sessions gs
      where gs.id = p_competition_id
        and gs.game_kind = 'competition'
    ) then
      raise exception 'Competition not found';
    end if;

    if not exists (
      select 1
      from public.session_players sp
      where sp.session_id = p_competition_id
        and sp.padel_player_id = p_padel_player_id
    )
    and not exists (
      select 1
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      where m.session_id = p_competition_id
        and mp.padel_player_id = p_padel_player_id
    ) then
      raise exception 'Player not in this competition';
    end if;
  end if;

  select link_token into v_token
  from public.player_line_link_requests
  where padel_player_id = p_padel_player_id
    and used_at is null
  order by created_at desc
  limit 1;

  if found then
    return v_token;
  end if;

  v_token := 'lpl_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.player_line_link_requests (
    link_token,
    competition_id,
    padel_player_id,
    expires_at
  )
  values (
    v_token,
    p_competition_id,
    p_padel_player_id,
    'infinity'::timestamptz
  );

  return v_token;
end;
$body$;

create or replace function public.link_padel_player_with_line(
  p_link_token text,
  p_profile_id uuid,
  p_line_user_id text,
  p_line_display_name text,
  p_line_picture_url text
)
returns table (
  competition_id uuid,
  padel_player_id uuid,
  handoff_token text
)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_req public.player_line_link_requests%rowtype;
  v_handoff text := 'lph_' || replace(gen_random_uuid()::text, '-', '');
  v_target_profile uuid;
begin
  select * into v_req
  from public.player_line_link_requests
  where link_token = p_link_token
  for update;

  if not found then
    raise exception 'Invalid link request';
  end if;

  if v_req.used_at is not null then
    raise exception 'Link request already used';
  end if;

  select coalesce(
    (select pp.profile_id from public.padel_players pp where pp.id = v_req.padel_player_id),
    p_profile_id
  )
  into v_target_profile;

  update public.profiles p
  set
    line_user_id = p_line_user_id,
    display_name = coalesce(nullif(btrim(p_line_display_name), ''), p.display_name),
    avatar_url = coalesce(p_line_picture_url, p.avatar_url)
  where p.id = v_target_profile;

  update public.padel_players pp
  set profile_id = v_target_profile,
      line_user_id = p_line_user_id,
      line_display_name = p_line_display_name,
      line_picture_url = p_line_picture_url,
      linked_at = now(),
      updated_at = now()
  where pp.id = v_req.padel_player_id
    and (pp.profile_id is null or pp.profile_id = v_target_profile)
    and (pp.line_user_id is null or btrim(pp.line_user_id) = '');

  if not found then
    raise exception 'Player not found or already linked';
  end if;

  update public.session_players sp
  set profile_id = v_target_profile,
      guest_name = null,
      padel_player_id = v_req.padel_player_id
  where sp.padel_player_id = v_req.padel_player_id
    and (sp.profile_id is null or sp.profile_id = v_target_profile);

  update public.match_players mp
  set profile_id = v_target_profile
  where mp.padel_player_id = v_req.padel_player_id
    and (mp.profile_id is null or mp.profile_id = v_target_profile);

  update public.player_line_link_requests
  set used_at = now()
  where link_token = p_link_token;

  competition_id := v_req.competition_id;
  padel_player_id := v_req.padel_player_id;
  handoff_token := v_handoff;

  return next;
end;
$body$;

create or replace function public.store_player_line_handoff(
  p_handoff_token text,
  p_competition_id uuid,
  p_padel_player_id uuid,
  p_line_user_id text,
  p_access_token text,
  p_refresh_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  insert into public.player_line_handoff_tokens (
    handoff_token,
    competition_id,
    padel_player_id,
    line_user_id,
    access_token,
    refresh_token,
    expires_at
  )
  values (
    p_handoff_token,
    p_competition_id,
    p_padel_player_id,
    p_line_user_id,
    p_access_token,
    p_refresh_token,
    'infinity'::timestamptz
  );
end;
$body$;

create or replace function public.consume_player_line_handoff(p_handoff_token text)
returns table (
  competition_id uuid,
  padel_player_id uuid,
  line_user_id text,
  access_token text,
  refresh_token text
)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_row public.player_line_handoff_tokens%rowtype;
begin
  select * into v_row
  from public.player_line_handoff_tokens
  where handoff_token = p_handoff_token
  for update;

  if not found then
    raise exception 'Invalid handoff token';
  end if;

  if v_row.used_at is not null then
    raise exception 'Handoff token already used';
  end if;

  update public.player_line_handoff_tokens
  set used_at = now()
  where handoff_token = p_handoff_token;

  competition_id := v_row.competition_id;
  padel_player_id := v_row.padel_player_id;
  line_user_id := v_row.line_user_id;
  access_token := v_row.access_token;
  refresh_token := v_row.refresh_token;

  return next;
end;
$body$;
