-- Fix ranked Americano rotation to match client schedule (rotate band, then split).
-- Pre-assign all rounds at start; allow admin to rebuild active + pending rounds.

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
  v_band uuid[4];
  v_view uuid[4];
  v_offset int;
  v_split_idx int;
  v_split_a int[];
  v_split_b int[];
  v_j int;
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

    for v_j in 1..4 loop
      v_band[v_j] := v_ranked[v_band_base + v_j];
    end loop;

    if v_round_number = 1 then
      v_offset := 0;
      v_split_a := array[3, 2];
      v_split_b := array[1, 4];
      for v_j in 1..4 loop
        v_view[v_j] := v_band[v_j];
      end loop;
    else
      case v_round_number
        when 2 then v_offset := 0; v_split_idx := 0;
        when 3 then v_offset := 0; v_split_idx := 1;
        when 4 then v_offset := 1; v_split_idx := 0;
        when 5 then v_offset := 1; v_split_idx := 1;
        when 6 then v_offset := 2; v_split_idx := 0;
        when 7 then v_offset := 2; v_split_idx := 1;
        when 8 then v_offset := 3; v_split_idx := 0;
        else
          v_offset := (floor((v_round_number - 2)::numeric / 2)::int) % 4;
          v_split_idx := (v_round_number - 2) % 2;
      end case;

      if v_split_idx = 0 then
        v_split_a := array[1, 4];
        v_split_b := array[2, 3];
      else
        v_split_a := array[1, 3];
        v_split_b := array[2, 4];
      end if;

      for v_j in 1..4 loop
        v_view[v_j] := v_band[((v_j - 1 + v_offset) % 4) + 1];
      end loop;
    end if;

    foreach v_idx in array v_split_a loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
      from public.session_players sp where sp.id = v_view[v_idx];
    end loop;

    foreach v_idx in array v_split_b loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
      from public.session_players sp where sp.id = v_view[v_idx];
    end loop;
  end loop;
end;
$body$;

create or replace function public.rebuild_competition_schedule(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_round record;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.competition_started_at is null then
    raise exception 'Competition has not started';
  end if;
  if v_session.status = 'complete' then
    raise exception 'Competition is complete';
  end if;

  for v_round in
    select id
    from public.competition_rounds
    where session_id = p_session_id
      and status in ('active', 'pending')
    order by round_number
  loop
    perform public.assign_competition_round(v_round.id, p_session_id);
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

    perform public.assign_competition_round(v_round_id, p_session_id);
  end loop;

  update public.game_sessions
  set status = 'locked', competition_started_at = now()
  where id = p_session_id;
end;
$body$;

grant execute on function public.rebuild_competition_schedule(uuid) to authenticated;
