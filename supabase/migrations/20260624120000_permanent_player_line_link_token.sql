-- One permanent LINE link QR token per padel_player (stable forever, idempotent create).

alter table public.padel_players
  add column if not exists line_link_token text;

update public.padel_players pp
set line_link_token = sub.link_token
from (
  select distinct on (r.padel_player_id)
    r.padel_player_id,
    r.link_token
  from public.player_line_link_requests r
  order by r.padel_player_id, r.used_at nulls first, r.created_at asc
) sub
where pp.id = sub.padel_player_id
  and pp.line_link_token is null;

update public.padel_players
set line_link_token = 'lpl_' || replace(gen_random_uuid()::text, '-', '')
where line_link_token is null;

create unique index if not exists padel_players_line_link_token_uidx
  on public.padel_players (line_link_token);

delete from public.player_line_link_requests r
using public.padel_players pp
where r.padel_player_id = pp.id
  and r.link_token <> pp.line_link_token;

insert into public.player_line_link_requests (link_token, padel_player_id, expires_at)
select pp.line_link_token, pp.id, 'infinity'::timestamptz
from public.padel_players pp
where pp.line_link_token is not null
on conflict (link_token) do nothing;

create or replace function public.padel_player_still_linkable(p_padel_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.padel_players pp
    left join public.profiles p on p.id = pp.profile_id
    where pp.id = p_padel_player_id
      and coalesce(nullif(btrim(pp.line_user_id), ''), '') = ''
      and coalesce(nullif(btrim(p.line_user_id), ''), '') = ''
  );
$$;

create or replace function public.find_or_create_padel_player(
  p_display_name text,
  p_guest_email text default null,
  p_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_id uuid;
  v_name text;
  v_email text;
  v_norm text;
begin
  if p_profile_id is not null then
    select id into v_id from public.padel_players where profile_id = p_profile_id;
    if found then
      return v_id;
    end if;

    select display_name into v_name from public.profiles where id = p_profile_id;

    insert into public.padel_players (display_name, profile_id, linked_at)
    values (coalesce(nullif(btrim(v_name), ''), btrim(p_display_name)), p_profile_id, now())
    on conflict (profile_id) where profile_id is not null do nothing;

    select id into v_id from public.padel_players where profile_id = p_profile_id;
    if v_id is null then
      raise exception 'Could not create padel player for profile';
    end if;
    return v_id;
  end if;

  v_norm := lower(btrim(p_display_name));
  v_email := nullif(btrim(p_guest_email), '');
  if v_norm = '' then
    raise exception 'Display name required';
  end if;

  select id into v_id
  from public.padel_players
  where profile_id is null
    and normalized_name = v_norm
    and coalesce(guest_email, '') = coalesce(v_email, '')
  order by created_at
  limit 1;

  if found then
    return v_id;
  end if;

  insert into public.padel_players (display_name, guest_email)
  values (btrim(p_display_name), v_email)
  returning id into v_id;

  return v_id;
end;
$body$;

create or replace function public.ensure_linkable_padel_player(p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_padel_id uuid;
  v_profile public.profiles%rowtype;
begin
  select pp.id into v_padel_id
  from public.padel_players pp
  where pp.id = p_player_id
    and pp.line_user_id is null
    and (
      pp.profile_id is null
      or exists (
        select 1
        from public.profiles p
        where p.id = pp.profile_id
          and p.line_user_id is null
      )
    );

  if found then
    return v_padel_id;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_player_id
    and line_user_id is null;

  if not found then
    return null;
  end if;

  select id into v_padel_id
  from public.padel_players
  where profile_id = p_player_id
  limit 1;

  if v_padel_id is not null then
    return v_padel_id;
  end if;

  insert into public.padel_players (display_name, profile_id, linked_at)
  values (v_profile.display_name, p_player_id, now())
  on conflict (profile_id) where profile_id is not null do nothing;

  select id into v_padel_id
  from public.padel_players
  where profile_id = p_player_id;

  return v_padel_id;
end;
$body$;

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
  perform pg_advisory_xact_lock(hashtext('lpl:' || p_padel_player_id::text));

  select * into v_player
  from public.padel_players
  where id = p_padel_player_id
  for update;

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

  v_token := nullif(btrim(v_player.line_link_token), '');

  if v_token is null then
    v_token := 'lpl_' || replace(gen_random_uuid()::text, '-', '');
    update public.padel_players
    set line_link_token = v_token,
        updated_at = now()
    where id = p_padel_player_id;
  end if;

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
  )
  on conflict (link_token) do update
    set
      competition_id = coalesce(excluded.competition_id, player_line_link_requests.competition_id),
      expires_at = 'infinity'::timestamptz,
      used_at = case
        when public.padel_player_still_linkable(p_padel_player_id) then null
        else player_line_link_requests.used_at
      end;

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

  if v_req.used_at is not null
    and not public.padel_player_still_linkable(v_req.padel_player_id) then
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

grant execute on function public.padel_player_still_linkable(uuid) to anon, authenticated;
