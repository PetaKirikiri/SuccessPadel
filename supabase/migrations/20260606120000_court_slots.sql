-- Court-based game booking: courts, hourly slots, player caps, multi-court groups
-- (cancelled status added in 20260606115900_add_cancelled_status.sql)

create type public.game_visibility as enum ('open', 'private');
create type public.game_kind as enum ('court', 'competition');
create type public.player_cap_mode as enum ('strict', 'flexible');
create type public.rotation_mode as enum ('between_courts');

-- courts
create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.courts (name, sort_order) values
  ('Court 1', 1),
  ('Court 2', 2),
  ('Court 3', 3),
  ('Court 4', 4);

-- game groups (multi-court rotation)
create table public.game_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id),
  rotation_enabled boolean not null default false,
  rotation_mode public.rotation_mode not null default 'between_courts',
  created_at timestamptz not null default now()
);

-- extend game_sessions
alter table public.game_sessions
  alter column season_id drop not null;

alter table public.game_sessions
  add column if not exists court_id uuid references public.courts (id),
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists visibility public.game_visibility,
  add column if not exists game_kind public.game_kind not null default 'competition',
  add column if not exists target_players int,
  add column if not exists player_cap_mode public.player_cap_mode,
  add column if not exists game_group_id uuid references public.game_groups (id) on delete set null;

-- tag existing rows as competition
update public.game_sessions set game_kind = 'competition' where game_kind is null or court_id is null;

create index if not exists game_sessions_court_id_idx on public.game_sessions (court_id);
create index if not exists game_sessions_starts_at_idx on public.game_sessions (starts_at);
create index if not exists game_sessions_game_kind_idx on public.game_sessions (game_kind);

-- hourly slots
create table public.game_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  slot_index int not null,
  unique (session_id, slot_index)
);

create index game_slots_session_id_idx on public.game_slots (session_id);
create index game_slots_starts_at_idx on public.game_slots (starts_at);

-- players per hour block
create table public.slot_players (
  slot_id uuid not null references public.game_slots (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (slot_id, profile_id)
);

create index slot_players_profile_id_idx on public.slot_players (profile_id);

-- rotation: which court per player per slot
create table public.slot_court_assignments (
  slot_id uuid not null references public.game_slots (id) on delete cascade,
  court_id uuid not null references public.courts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (slot_id, profile_id)
);

create index slot_court_assignments_slot_id_idx on public.slot_court_assignments (slot_id);

-- overlap prevention for court bookings
create extension if not exists btree_gist;

alter table public.game_sessions
  add constraint game_sessions_court_time_no_overlap
  exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (
    game_kind = 'court'
    and court_id is not null
    and starts_at is not null
    and ends_at is not null
    and status not in ('draft', 'cancelled')
  );

-- helpers
create or replace function public.session_roster_count(p_session_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct sp.profile_id)::int
  from public.game_slots gs
  join public.slot_players sp on sp.slot_id = gs.id
  where gs.session_id = p_session_id;
$$;

create or replace function public.can_join_session(p_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions%rowtype;
  v_count int;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then return false;
  if v_session.status <> 'open' then return false;
  if v_session.visibility <> 'open' then return false;
  if v_session.player_cap_mode = 'flexible' then return true;
  v_count := public.session_roster_count(p_session_id);
  if v_session.max_players is null then
    return v_count < coalesce(v_session.target_players, 4);
  end if;
  return v_count < v_session.max_players;
end;
$$;

create or replace function public.get_court_availability(p_date date, p_court_id uuid)
returns table (hour_start timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with hours as (
    select generate_series(
      (p_date::text || ' 06:00:00+07')::timestamptz,
      (p_date::text || ' 21:00:00+07')::timestamptz,
      interval '1 hour'
    ) as hour_start
  )
  select h.hour_start
  from hours h
  where not exists (
    select 1 from public.game_sessions gs
    where gs.game_kind = 'court'
      and gs.court_id = p_court_id
      and gs.status not in ('draft', 'cancelled')
      and gs.starts_at is not null
      and gs.ends_at is not null
      and tstzrange(gs.starts_at, gs.ends_at, '[)') && tstzrange(h.hour_start, h.hour_start + interval '1 hour', '[)')
  )
  order by h.hour_start;
$$;

create or replace function public.create_court_game(
  p_court_id uuid,
  p_starts_at timestamptz,
  p_duration_hours int,
  p_visibility public.game_visibility,
  p_target_players int,
  p_player_cap_mode public.player_cap_mode,
  p_max_players int,
  p_status public.session_status,
  p_slot_players jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_ends_at timestamptz;
  v_title text;
  v_court_name text;
  v_slot_id uuid;
  v_i int;
  v_slot_start timestamptz;
  v_slot_players jsonb;
  v_profile_id uuid;
  v_season_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_duration_hours < 1 then
    raise exception 'Duration must be at least 1 hour';
  end if;

  v_ends_at := p_starts_at + (p_duration_hours || ' hours')::interval;

  select name into v_court_name from public.courts where id = p_court_id;
  v_title := coalesce(v_court_name, 'Court') || ' · '
    || to_char(p_starts_at at time zone 'Asia/Bangkok', 'DD Mon')
    || ' · '
    || to_char(p_starts_at at time zone 'Asia/Bangkok', 'HH24:MI')
    || '–'
    || to_char(v_ends_at at time zone 'Asia/Bangkok', 'HH24:MI');

  select id into v_season_id from public.seasons where is_active limit 1;

  insert into public.game_sessions (
    season_id, title, starts_on, ends_on, status, game_kind,
    court_id, starts_at, ends_at, visibility, target_players,
    player_cap_mode, max_players, created_by,
    partnership_mode, scoring_preset, who_can_log_matches
  ) values (
    v_season_id,
    v_title,
    (p_starts_at at time zone 'Asia/Bangkok')::date,
    (v_ends_at at time zone 'Asia/Bangkok')::date,
    p_status,
    'court',
    p_court_id,
    p_starts_at,
    v_ends_at,
    p_visibility,
    p_target_players,
    p_player_cap_mode,
    case when p_player_cap_mode = 'strict' then coalesce(p_max_players, p_target_players) else null end,
    auth.uid(),
    'rotating',
    'standard',
    'roster_members'
  )
  returning id into v_session_id;

  for v_i in 0..(p_duration_hours - 1) loop
    v_slot_start := p_starts_at + (v_i || ' hours')::interval;
    insert into public.game_slots (session_id, starts_at, ends_at, slot_index)
    values (v_session_id, v_slot_start, v_slot_start + interval '1 hour', v_i)
    returning id into v_slot_id;

  end loop;

  -- assign players per slot from jsonb: [{slot_index, profile_ids: [uuid,...]}]
  for v_slot_players in select * from jsonb_array_elements(p_slot_players)
  loop
    select gs.id into v_slot_id
    from public.game_slots gs
    where gs.session_id = v_session_id
      and gs.slot_index = (v_slot_players ->> 'slot_index')::int;

    for v_profile_id in
      select (jsonb_array_elements_text(v_slot_players -> 'profile_ids'))::uuid
    loop
      insert into public.slot_players (slot_id, profile_id)
      values (v_slot_id, v_profile_id)
      on conflict do nothing;
    end loop;
  end loop;

  return v_session_id;
end;
$$;

create or replace function public.join_game_slot(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_on_court int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select gs.session_id into v_session_id
  from public.game_slots gs where gs.id = p_slot_id;
  if not found then raise exception 'Slot not found'; end if;

  if not public.can_join_session(v_session_id) then
    raise exception 'Game is full';
  end if;

  select count(*) into v_on_court
  from public.slot_players sp
  where sp.slot_id = p_slot_id;

  if v_on_court >= 4 then
    raise exception 'This hour block already has 4 players on court';
  end if;

  insert into public.slot_players (slot_id, profile_id)
  values (p_slot_id, auth.uid())
  on conflict do nothing;
end;
$$;

create or replace function public.expand_game_to_two_courts(
  p_session_id uuid,
  p_second_court_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions%rowtype;
  v_group_id uuid;
  v_new_session_id uuid;
  v_slot record;
  v_new_slot_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  if v_session.game_kind <> 'court' then raise exception 'Not a court game'; end if;

  if v_session.game_group_id is not null then
    raise exception 'Already part of a group';
  end if;

  if exists (
    select 1 from public.game_sessions gs
    where gs.game_kind = 'court'
      and gs.court_id = p_second_court_id
      and gs.status not in ('draft', 'cancelled')
      and gs.starts_at is not null
      and gs.ends_at is not null
      and tstzrange(gs.starts_at, gs.ends_at, '[)') && tstzrange(v_session.starts_at, v_session.ends_at, '[)')
  ) then
    raise exception 'Second court not available for this time range';
  end if;

  insert into public.game_groups (created_by, rotation_enabled, rotation_mode)
  values (auth.uid(), true, 'between_courts')
  returning id into v_group_id;

  update public.game_sessions set game_group_id = v_group_id where id = p_session_id;

  insert into public.game_sessions (
    season_id, title, starts_on, ends_on, status, game_kind,
    court_id, starts_at, ends_at, visibility, target_players,
    player_cap_mode, max_players, created_by, game_group_id,
    partnership_mode, scoring_preset, who_can_log_matches
  )
  select
    v_session.season_id,
    replace(v_session.title, (select c.name from public.courts c where c.id = v_session.court_id), (select c2.name from public.courts c2 where c2.id = p_second_court_id)),
    v_session.starts_on,
    v_session.ends_on,
    v_session.status,
    'court',
    p_second_court_id,
    v_session.starts_at,
    v_session.ends_at,
    v_session.visibility,
    v_session.target_players,
    v_session.player_cap_mode,
    v_session.max_players,
    auth.uid(),
    v_group_id,
    v_session.partnership_mode,
    v_session.scoring_preset,
    v_session.who_can_log_matches
  returning id into v_new_session_id;

  for v_slot in select * from public.game_slots where session_id = p_session_id order by slot_index
  loop
    insert into public.game_slots (session_id, starts_at, ends_at, slot_index)
    values (v_new_session_id, v_slot.starts_at, v_slot.ends_at, v_slot.slot_index)
    returning id into v_new_slot_id;
  end loop;

  return v_group_id;
end;
$$;

grant execute on function public.session_roster_count(uuid) to authenticated;
grant execute on function public.can_join_session(uuid) to authenticated;
grant execute on function public.get_court_availability(date, uuid) to authenticated;
grant execute on function public.create_court_game(uuid, timestamptz, int, public.game_visibility, int, public.player_cap_mode, int, public.session_status, jsonb) to authenticated;
grant execute on function public.join_game_slot(uuid) to authenticated;
grant execute on function public.expand_game_to_two_courts(uuid, uuid) to authenticated;

-- RLS
alter table public.courts enable row level security;
alter table public.game_groups enable row level security;
alter table public.game_slots enable row level security;
alter table public.slot_players enable row level security;
alter table public.slot_court_assignments enable row level security;

create policy courts_select on public.courts for select to authenticated using (true);
create policy courts_admin on public.courts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy game_groups_select on public.game_groups for select to authenticated using (true);
create policy game_groups_admin on public.game_groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy game_slots_select on public.game_slots for select to authenticated using (
  exists (
    select 1 from public.game_sessions gs
    where gs.id = session_id
      and (
        gs.visibility = 'open'
        or public.is_admin()
        or exists (
          select 1 from public.slot_players sp
          join public.game_slots gsl on gsl.id = sp.slot_id
          where gsl.session_id = gs.id and sp.profile_id = auth.uid()
        )
      )
  )
);

create policy game_slots_admin on public.game_slots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy slot_players_select on public.slot_players for select to authenticated using (true);

create policy slot_players_insert on public.slot_players for insert to authenticated with check (
  public.is_admin()
  or (
    profile_id = auth.uid()
    and exists (
      select 1 from public.game_slots gsl
      join public.game_sessions gs on gs.id = gsl.session_id
      where gsl.id = slot_id
        and gs.visibility = 'open'
        and gs.status = 'open'
        and public.can_join_session(gs.id)
    )
  )
);

create policy slot_players_delete on public.slot_players for delete to authenticated using (
  public.is_admin() or profile_id = auth.uid()
);

create policy slot_players_admin on public.slot_players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy slot_court_assignments_select on public.slot_court_assignments for select to authenticated using (true);
create policy slot_court_assignments_admin on public.slot_court_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- update game_sessions select for private visibility
drop policy if exists game_sessions_select on public.game_sessions;
create policy game_sessions_select on public.game_sessions for select to authenticated using (
  game_kind = 'competition'
  or visibility = 'open'
  or public.is_admin()
  or exists (
    select 1 from public.game_slots gsl
    join public.slot_players sp on sp.slot_id = gsl.id
    where gsl.session_id = game_sessions.id and sp.profile_id = auth.uid()
  )
);
