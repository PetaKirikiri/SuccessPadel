-- Ranked Americano: 8 games × 14 min + 1 min break. Roster order = skill (top strongest).

alter table public.session_players
  add column if not exists rank_order int;

with ranked as (
  select id, (row_number() over (partition by session_id order by id) - 1)::int as rn
  from public.session_players
)
update public.session_players sp
set rank_order = ranked.rn
from ranked
where sp.id = ranked.id and sp.rank_order is null;

alter table public.session_players alter column rank_order set default 0;

create or replace function public.assign_ranked_americano_round(p_round_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_round_number int;
  v_ranked uuid[];
  v_courts uuid[];
  v_courts_needed int;
  v_court_slot int;
  v_court_id uuid;
  v_band_base int;
  v_offset int;
  v_split int;
  v_team_a_idx int[];
  v_team_b_idx int[];
  v_idx int;
begin
  delete from public.competition_round_players where round_id = p_round_id;

  select round_number into v_round_number
  from public.competition_rounds where id = p_round_id;

  select coalesce(array_agg(sp.id order by sp.rank_order, sp.id), '{}')
  into v_ranked
  from public.session_players sp
  where sp.session_id = p_session_id;

  if coalesce(array_length(v_ranked, 1), 0) < 4 then
    raise exception 'Need at least 4 players';
  end if;

  select coalesce(array_agg(c.id order by c.sort_order), '{}')
  into v_courts
  from public.courts c
  where c.is_active;

  v_courts_needed := greatest(1, coalesce(array_length(v_ranked, 1), 0) / 4);
  if array_length(v_courts, 1) > v_courts_needed then
    v_courts := v_courts[1:v_courts_needed];
  end if;

  for v_court_slot in 1..v_courts_needed loop
    v_band_base := (v_court_slot - 1) * 4;
    v_court_id := v_courts[v_court_slot];

    -- band +1 strongest, +2 stronger, +3 strong, +4 weakest
    if v_round_number = 1 then
      v_team_a_idx := array[v_band_base + 3, v_band_base + 2];
      v_team_b_idx := array[v_band_base + 1, v_band_base + 4];
    else
      v_offset := (floor((v_round_number - 2)::numeric / 2)::int) % 4;
      v_split := (v_round_number - 2) % 2;
      if v_split = 0 then
        v_team_a_idx := array[
          v_band_base + ((0 + v_offset) % 4) + 1,
          v_band_base + ((3 + v_offset) % 4) + 1
        ];
        v_team_b_idx := array[
          v_band_base + ((1 + v_offset) % 4) + 1,
          v_band_base + ((2 + v_offset) % 4) + 1
        ];
      else
        v_team_a_idx := array[
          v_band_base + ((0 + v_offset) % 4) + 1,
          v_band_base + ((2 + v_offset) % 4) + 1
        ];
        v_team_b_idx := array[
          v_band_base + ((1 + v_offset) % 4) + 1,
          v_band_base + ((3 + v_offset) % 4) + 1
        ];
      end if;
    end if;

    foreach v_idx in array v_team_a_idx loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
      from public.session_players sp where sp.id = v_ranked[v_idx];
    end loop;

    foreach v_idx in array v_team_b_idx loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
      from public.session_players sp where sp.id = v_ranked[v_idx];
    end loop;
  end loop;
end;
$body$;

create or replace function public.assign_competition_round(p_round_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_entries uuid[];
  v_courts uuid[];
  v_court_idx int := 1;
  v_batch uuid[];
  v_shuffled uuid[];
  v_court_id uuid;
  v_i int;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;

  if v_session.partnership_mode = 'americano'
    or coalesce(v_session.rules, '') ilike '%americano%' then
    perform public.assign_ranked_americano_round(p_round_id, p_session_id);
    return;
  end if;

  delete from public.competition_round_players where round_id = p_round_id;

  select coalesce(array_agg(sp.id order by random()), '{}')
  into v_entries
  from public.session_players sp
  where sp.session_id = p_session_id;

  select coalesce(array_agg(c.id order by c.sort_order), '{}')
  into v_courts
  from public.courts c
  where c.is_active;

  if coalesce(array_length(v_courts, 1), 0) = 0 then
    raise exception 'No active courts';
  end if;

  while coalesce(array_length(v_entries, 1), 0) >= 4 loop
    v_batch := v_entries[1:4];
    v_entries := v_entries[5:coalesce(array_length(v_entries, 1), 0)];

    select coalesce(array_agg(x order by random()), '{}')
    into v_shuffled
    from unnest(v_batch) as x;

    v_court_id := v_courts[v_court_idx];
    v_court_idx := v_court_idx + 1;
    if v_court_idx > coalesce(array_length(v_courts, 1), 0) then
      v_court_idx := 1;
    end if;

    for v_i in 1..2 loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
      from public.session_players sp
      where sp.id = v_shuffled[v_i];
    end loop;
    for v_i in 3..4 loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
      from public.session_players sp
      where sp.id = v_shuffled[v_i];
    end loop;
  end loop;
end;
$body$;

create or replace function public.start_competition(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_break_min int := 1;
  v_game_min int := 14;
  v_slot_min int := 15;
  v_total_rounds int := 8;
  v_round_id uuid;
  v_i int;
  v_is_americano boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'open' then
    raise exception 'Competition must be open';
  end if;
  if v_session.starts_at is null or v_session.ends_at is null then
    raise exception 'Start and end time required';
  end if;

  if (select count(*) from public.session_players where session_id = p_session_id) < 4 then
    raise exception 'Need at least 4 players';
  end if;

  v_is_americano := v_session.partnership_mode = 'americano'
    or coalesce(v_session.rules, '') ilike '%americano%';

  if not v_is_americano then
    v_game_min := 15;
    v_slot_min := v_game_min + v_break_min;
    v_total_rounds := greatest(1, (
      (extract(epoch from (v_session.ends_at - v_session.starts_at)) / 60.0)::int + v_break_min
    ) / v_slot_min);
  end if;

  delete from public.competition_rounds where session_id = p_session_id;

  for v_i in 1..v_total_rounds loop
    insert into public.competition_rounds (
      session_id, round_number, is_final, starts_at, ends_at, status
    ) values (
      p_session_id,
      v_i,
      v_i = v_total_rounds,
      v_session.starts_at + ((v_i - 1) * v_slot_min) * interval '1 minute',
      v_session.starts_at + (((v_i - 1) * v_slot_min) + v_game_min) * interval '1 minute',
      case when v_i = 1 then 'active' else 'pending' end
    )
    returning id into v_round_id;

    if v_i = 1 then
      perform public.assign_competition_round(v_round_id, p_session_id);
    end if;
  end loop;

  update public.game_sessions
  set status = 'locked', competition_started_at = now()
  where id = p_session_id;
end;
$body$;

create or replace function public.reorder_competition_roster(p_session_id uuid, p_roster_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_i int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if exists (
    select 1 from public.game_sessions gs
    where gs.id = p_session_id
      and (gs.status <> 'open' or gs.competition_started_at is not null)
  ) then
    raise exception 'Sign-ups are closed';
  end if;

  for v_i in 1..coalesce(array_length(p_roster_ids, 1), 0) loop
    update public.session_players
    set rank_order = v_i - 1
    where id = p_roster_ids[v_i] and session_id = p_session_id;
  end loop;
end;
$body$;

grant execute on function public.reorder_competition_roster(uuid, uuid[]) to authenticated;
grant execute on function public.assign_ranked_americano_round(uuid, uuid) to authenticated;

create or replace function public.add_competition_guests(p_guests jsonb, p_session_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_guest jsonb;
  v_name text;
  v_email text;
  v_added int := 0;
  v_next_rank int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'open' or v_session.competition_started_at is not null then
    raise exception 'Sign-ups are closed';
  end if;

  select coalesce(max(rank_order) + 1, 0) into v_next_rank
  from public.session_players
  where session_id = p_session_id;

  for v_guest in select * from jsonb_array_elements(coalesce(p_guests, '[]'::jsonb))
  loop
    v_name := btrim(v_guest ->> 'name');
    if v_name = '' then
      continue;
    end if;
    if not public.can_join_session(p_session_id) then
      raise exception 'Competition is full';
    end if;

    v_email := nullif(lower(btrim(v_guest ->> 'email')), '');

    insert into public.session_players (session_id, guest_name, guest_email, rank_order)
    values (p_session_id, v_name, v_email, v_next_rank);

    v_next_rank := v_next_rank + 1;
    v_added := v_added + 1;
  end loop;

  return v_added;
end;
$body$;
