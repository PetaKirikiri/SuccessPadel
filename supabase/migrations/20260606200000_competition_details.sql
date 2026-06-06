-- Competition metadata + member join flow.

alter table public.game_sessions
  add column if not exists skill_level text,
  add column if not exists gender text,
  add column if not exists rules text;

create or replace function public.session_roster_count(p_session_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $body$
declare
  v_kind public.game_kind;
  v_count int;
begin
  select game_kind into v_kind from public.game_sessions where id = p_session_id;
  if not found then return 0; end if;

  if v_kind = 'competition' then
    select count(*)::int into v_count
    from public.session_players
    where session_id = p_session_id;
    return v_count;
  end if;

  select count(distinct sp.profile_id)::int into v_count
  from public.game_slots gs
  join public.slot_players sp on sp.slot_id = gs.id
  where gs.session_id = p_session_id;

  return coalesce(v_count, 0);
end;
$body$;

create or replace function public.can_join_session(p_session_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_count int;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then return false;
  if v_session.status <> 'open' then return false;
  if v_session.visibility = 'private' then return false;
  if v_session.player_cap_mode = 'flexible' then return true;
  v_count := public.session_roster_count(p_session_id);
  if v_session.max_players is null and v_session.target_players is null then
    return true;
  end if;
  if v_session.max_players is null then
    return v_count < coalesce(v_session.target_players, 4);
  end if;
  return v_count < v_session.max_players;
end;
$body$;

create or replace function public.join_competition(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.game_sessions
    where id = p_session_id and game_kind = 'competition'
  ) then
    raise exception 'Not a competition';
  end if;

  if not public.can_join_session(p_session_id) then
    raise exception 'Competition is full or closed';
  end if;

  insert into public.session_players (session_id, profile_id)
  values (p_session_id, auth.uid())
  on conflict do nothing;
end;
$body$;

grant execute on function public.join_competition(uuid) to authenticated;

-- Backfill open competitions with sensible defaults.
update public.game_sessions
set
  visibility = coalesce(visibility, 'open'),
  skill_level = coalesce(skill_level, 'All levels'),
  gender = coalesce(gender, 'Mixed'),
  rules = coalesce(
    rules,
    case partnership_mode
      when 'fixed_pairs' then 'Fixed pairs for the session. Standard padel scoring.'
      when 'americano' then 'Americano rotation format. Points per round.'
      else 'Rotating partners each round. Standard scoring.'
    end
  )
where game_kind = 'competition';

-- Seed upcoming club competitions (idempotent).
do $body$
declare
  v_season_id uuid;
  v_session_id uuid;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  select id into v_season_id from public.seasons where is_active limit 1;
  if v_season_id is null then
    insert into public.seasons (name, starts_on, is_active)
    values ('Club Season', current_date, true)
    returning id into v_season_id;
  end if;

  if not exists (
    select 1 from public.game_sessions where title = 'Monday Ladder · Low Inter'
  ) then
    v_starts := (current_date + interval '3 days')::date + time '18:00' at time zone 'Asia/Bangkok';
    v_ends := v_starts + interval '2 hours';

    insert into public.game_sessions (
      season_id, title, starts_on, ends_on, status, game_kind,
      starts_at, ends_at, visibility, target_players, max_players,
      player_cap_mode, partnership_mode, scoring_preset, who_can_log_matches,
      skill_level, gender, rules
    ) values (
      v_season_id,
      'Monday Ladder · Low Inter',
      (v_starts at time zone 'Asia/Bangkok')::date,
      (v_ends at time zone 'Asia/Bangkok')::date,
      'open',
      'competition',
      v_starts,
      v_ends,
      'open',
      8,
      8,
      'strict',
      'rotating',
      'standard',
      'roster_members',
      'Low Inter',
      'Mixed',
      'Rotating partners each round. Best of 3 sets. Points count toward the season ladder.'
    )
    returning id into v_session_id;

    insert into public.session_players (session_id, profile_id)
    select v_session_id, p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email in (
      'player1@fake.successpadel.test',
      'player2@fake.successpadel.test',
      'player3@fake.successpadel.test',
      'player4@fake.successpadel.test',
      'player5@fake.successpadel.test'
    )
    on conflict do nothing;
  end if;

  if not exists (
    select 1 from public.game_sessions where title = 'Wednesday Women · Intermediate'
  ) then
    v_starts := (current_date + interval '5 days')::date + time '19:00' at time zone 'Asia/Bangkok';
    v_ends := v_starts + interval '2 hours';

    insert into public.game_sessions (
      season_id, title, starts_on, ends_on, status, game_kind,
      starts_at, ends_at, visibility, target_players, max_players,
      player_cap_mode, partnership_mode, scoring_preset, who_can_log_matches,
      skill_level, gender, rules
    ) values (
      v_season_id,
      'Wednesday Women · Intermediate',
      (v_starts at time zone 'Asia/Bangkok')::date,
      (v_ends at time zone 'Asia/Bangkok')::date,
      'open',
      'competition',
      v_starts,
      v_ends,
      'open',
      8,
      8,
      'strict',
      'fixed_pairs',
      'standard',
      'roster_members',
      'Intermediate',
      'Women',
      'Bring your own partner or we will match you. Fixed pairs all evening. Standard scoring.'
    )
    returning id into v_session_id;

    insert into public.session_players (session_id, profile_id)
    select v_session_id, p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email in (
      'player6@fake.successpadel.test',
      'player7@fake.successpadel.test',
      'player8@fake.successpadel.test'
    )
    on conflict do nothing;
  end if;
end $body$;
