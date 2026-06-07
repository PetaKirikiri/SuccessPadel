-- LINE account linking: temporary link tokens + browser handoff (isolated from scoring).

alter table public.padel_players
  add column if not exists line_user_id text,
  add column if not exists line_display_name text,
  add column if not exists line_picture_url text;

create index if not exists padel_players_line_user_id_idx
  on public.padel_players (line_user_id)
  where line_user_id is not null;

create table public.player_line_link_requests (
  link_token text primary key,
  competition_id uuid references public.game_sessions (id) on delete cascade,
  padel_player_id uuid not null references public.padel_players (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index player_line_link_requests_expires_idx
  on public.player_line_link_requests (expires_at)
  where used_at is null;

create table public.player_line_handoff_tokens (
  handoff_token text primary key,
  competition_id uuid references public.game_sessions (id) on delete cascade,
  padel_player_id uuid not null references public.padel_players (id) on delete cascade,
  line_user_id text not null,
  status text not null default 'linked',
  access_token text not null,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index player_line_handoff_tokens_expires_idx
  on public.player_line_handoff_tokens (expires_at)
  where used_at is null;

alter table public.player_line_link_requests enable row level security;
alter table public.player_line_handoff_tokens enable row level security;

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
  v_token text := 'lpl_' || replace(gen_random_uuid()::text, '-', '');
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
    now() + interval '15 minutes'
  );

  return v_token;
end;
$body$;

grant execute on function public.create_player_line_link_request(uuid, uuid) to anon, authenticated;

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

  if v_req.expires_at < now() then
    raise exception 'Link request expired';
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
    now() + interval '5 minutes'
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

  if v_row.expires_at < now() then
    raise exception 'Handoff token expired';
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

grant execute on function public.consume_player_line_handoff(text) to anon, authenticated;
