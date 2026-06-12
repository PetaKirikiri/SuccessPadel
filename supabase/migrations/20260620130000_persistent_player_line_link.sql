-- LINE sign-up QR tokens stay valid until scanned (reuse unused token per player).

update public.player_line_link_requests
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
begin
  select * into v_player
  from public.padel_players
  where id = p_padel_player_id;

  if not found then
    raise exception 'Player not found';
  end if;

  if v_player.profile_id is not null then
    raise exception 'Player already linked';
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

  update public.padel_players pp
  set profile_id = p_profile_id,
      line_user_id = p_line_user_id,
      line_display_name = p_line_display_name,
      line_picture_url = p_line_picture_url,
      linked_at = now(),
      updated_at = now()
  where pp.id = v_req.padel_player_id
    and pp.profile_id is null;

  if not found then
    raise exception 'Player not found or already linked';
  end if;

  update public.session_players sp
  set profile_id = p_profile_id,
      guest_name = null,
      padel_player_id = v_req.padel_player_id
  where sp.padel_player_id = v_req.padel_player_id
    and sp.profile_id is null;

  update public.match_players mp
  set profile_id = p_profile_id
  where mp.padel_player_id = v_req.padel_player_id
    and mp.profile_id is null;

  update public.player_line_link_requests
  set used_at = now()
  where link_token = p_link_token;

  competition_id := v_req.competition_id;
  padel_player_id := v_req.padel_player_id;
  handoff_token := v_handoff;

  return next;
end;
$body$;

create or replace function public.list_guest_players_with_games()
returns table (
  id uuid,
  display_name text,
  game_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pp.id,
    pp.display_name,
    (
      select count(*)::bigint
      from (
        select sp.id
        from public.session_players sp
        where sp.padel_player_id = pp.id
        union all
        select mp.id
        from public.match_players mp
        where mp.padel_player_id = pp.id
      ) involved
    ) as game_count
  from public.padel_players pp
  where pp.profile_id is null
    and (
      exists (
        select 1
        from public.session_players sp
        where sp.padel_player_id = pp.id
      )
      or exists (
        select 1
        from public.match_players mp
        where mp.padel_player_id = pp.id
      )
    )
  order by pp.display_name;
$$;

grant execute on function public.list_guest_players_with_games() to authenticated;
