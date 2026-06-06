-- Americano rotation, leaderboard, guest backfill, competition completion.

alter type public.session_status add value if not exists 'complete';

alter table public.game_sessions
  add column if not exists competition_ended_at timestamptz;

-- Partner repeat count between two roster entries in prior rounds.
create or replace function public._americano_partner_count(
  p_session_id uuid,
  p_before_round int,
  p_a uuid,
  p_b uuid
)
returns int
language sql
stable
as $$
  select count(*)::int
  from public.competition_round_players crp1
  join public.competition_round_players crp2
    on crp1.round_id = crp2.round_id
   and crp1.court_id = crp2.court_id
   and crp1.team = crp2.team
   and crp1.roster_entry_id < crp2.roster_entry_id
  join public.competition_rounds cr on cr.id = crp1.round_id
  where cr.session_id = p_session_id
    and cr.round_number < p_before_round
    and (
      (crp1.roster_entry_id = p_a and crp2.roster_entry_id = p_b)
      or (crp1.roster_entry_id = p_b and crp2.roster_entry_id = p_a)
    );
$$;

-- Opponent repeat count (opposite teams, same court).
create or replace function public._americano_opponent_count(
  p_session_id uuid,
  p_before_round int,
  p_a uuid,
  p_b uuid
)
returns int
language sql
stable
as $$
  select count(*)::int
  from public.competition_round_players crp1
  join public.competition_round_players crp2
    on crp1.round_id = crp2.round_id
   and crp1.court_id = crp2.court_id
   and crp1.team <> crp2.team
  join public.competition_rounds cr on cr.id = crp1.round_id
  where cr.session_id = p_session_id
    and cr.round_number < p_before_round
    and (
      (crp1.roster_entry_id = p_a and crp2.roster_entry_id = p_b)
      or (crp1.roster_entry_id = p_b and crp2.roster_entry_id = p_a)
    );
$$;

create or replace function public._americano_pair_score(
  p_session_id uuid,
  p_before_round int,
  p_a uuid,
  p_b uuid
)
returns int
language sql
stable
as $$
  select public._americano_partner_count(p_session_id, p_before_round, p_a, p_b) * 3
       + public._americano_opponent_count(p_session_id, p_before_round, p_a, p_b);
$$;

create or replace function public._americano_quad_score(
  p_session_id uuid,
  p_before_round int,
  p_e1 uuid,
  p_e2 uuid,
  p_e3 uuid,
  p_e4 uuid
)
returns int
language sql
stable
as $$
  select public._americano_pair_score(p_session_id, p_before_round, p_e1, p_e2)
       + public._americano_pair_score(p_session_id, p_before_round, p_e1, p_e3)
       + public._americano_pair_score(p_session_id, p_before_round, p_e1, p_e4)
       + public._americano_pair_score(p_session_id, p_before_round, p_e2, p_e3)
       + public._americano_pair_score(p_session_id, p_before_round, p_e2, p_e4)
       + public._americano_pair_score(p_session_id, p_before_round, p_e3, p_e4);
$$;

create or replace function public.assign_americano_round(p_round_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_round_number int;
  v_remaining uuid[];
  v_courts uuid[];
  v_court_slot int := 0;
  v_court_id uuid;
  v_n int;
  v_best_score int;
  v_best_quad uuid[];
  v_team_a uuid[];
  v_team_b uuid[];
  v_split_score int;
  v_best_split_a uuid[];
  v_best_split_b uuid[];
  v_i int; v_j int; v_k int; v_l int;
  v_e1 uuid; v_e2 uuid; v_e3 uuid; v_e4 uuid;
begin
  delete from public.competition_round_players where round_id = p_round_id;

  select round_number into v_round_number
  from public.competition_rounds where id = p_round_id;

  select coalesce(array_agg(sp.id order by sp.id), '{}')
  into v_remaining
  from public.session_players sp
  where sp.session_id = p_session_id;

  select coalesce(array_agg(c.id order by c.sort_order), '{}')
  into v_courts
  from public.courts c
  where c.is_active;

  if coalesce(array_length(v_courts, 1), 0) = 0 then
    raise exception 'No active courts';
  end if;

  while coalesce(array_length(v_remaining, 1), 0) >= 4 loop
    v_n := array_length(v_remaining, 1);
    v_best_score := 2147483647;
    v_best_quad := null;

    for v_i in 1..(v_n - 3) loop
      for v_j in (v_i + 1)..(v_n - 2) loop
        for v_k in (v_j + 1)..(v_n - 1) loop
          for v_l in (v_k + 1)..v_n loop
            v_e1 := v_remaining[v_i];
            v_e2 := v_remaining[v_j];
            v_e3 := v_remaining[v_k];
            v_e4 := v_remaining[v_l];
            v_split_score := public._americano_quad_score(
              p_session_id, v_round_number, v_e1, v_e2, v_e3, v_e4
            );
            if v_split_score < v_best_score then
              v_best_score := v_split_score;
              v_best_quad := array[v_e1, v_e2, v_e3, v_e4];
            end if;
          end loop;
        end loop;
      end loop;
    end loop;

    if v_best_quad is null then
      exit;
    end if;

    v_e1 := v_best_quad[1];
    v_e2 := v_best_quad[2];
    v_e3 := v_best_quad[3];
    v_e4 := v_best_quad[4];

    v_best_score := 2147483647;
    v_best_split_a := null;
    v_best_split_b := null;

    -- Try three pairings; pick lowest partner-repeat split.
    v_split_score :=
      public._americano_partner_count(p_session_id, v_round_number, v_e1, v_e2)
      + public._americano_partner_count(p_session_id, v_round_number, v_e3, v_e4);
    if v_split_score < v_best_score then
      v_best_score := v_split_score;
      v_best_split_a := array[v_e1, v_e2];
      v_best_split_b := array[v_e3, v_e4];
    end if;

    v_split_score :=
      public._americano_partner_count(p_session_id, v_round_number, v_e1, v_e3)
      + public._americano_partner_count(p_session_id, v_round_number, v_e2, v_e4);
    if v_split_score < v_best_score then
      v_best_score := v_split_score;
      v_best_split_a := array[v_e1, v_e3];
      v_best_split_b := array[v_e2, v_e4];
    end if;

    v_split_score :=
      public._americano_partner_count(p_session_id, v_round_number, v_e1, v_e4)
      + public._americano_partner_count(p_session_id, v_round_number, v_e2, v_e3);
    if v_split_score < v_best_score then
      v_best_score := v_split_score;
      v_best_split_a := array[v_e1, v_e4];
      v_best_split_b := array[v_e2, v_e3];
    end if;

    v_court_slot := v_court_slot + 1;
    v_court_id := v_courts[((v_court_slot - 1 + v_round_number - 1) % array_length(v_courts, 1)) + 1];

    foreach v_e1 in array v_best_split_a loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
      from public.session_players sp where sp.id = v_e1;
    end loop;

    foreach v_e1 in array v_best_split_b loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
      from public.session_players sp where sp.id = v_e1;
    end loop;

    v_remaining := array(
      select x from unnest(v_remaining) as x
      where not (x = any(v_best_quad))
    );
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

  if v_session.partnership_mode = 'americano' then
    perform public.assign_americano_round(p_round_id, p_session_id);
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

create or replace function public._advance_competition_round_core(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_current public.competition_rounds%rowtype;
  v_next public.competition_rounds%rowtype;
begin
  select * into v_current
  from public.competition_rounds
  where session_id = p_session_id and status = 'active'
  order by round_number
  limit 1;

  if not found then
    raise exception 'No active round';
  end if;

  update public.competition_rounds
  set status = 'complete'
  where id = v_current.id;

  select * into v_next
  from public.competition_rounds
  where session_id = p_session_id and round_number = v_current.round_number + 1;

  if not found then
    update public.game_sessions
    set status = 'complete', competition_ended_at = now()
    where id = p_session_id;
    return;
  end if;

  perform public.assign_competition_round(v_next.id, p_session_id);

  update public.competition_rounds
  set status = 'active'
  where id = v_next.id;
end;
$body$;

create or replace function public.get_competition_leaderboard(p_session_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  total_points bigint,
  games bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mp.profile_id,
    p.display_name,
    coalesce(sum(mp.points_earned), 0)::bigint as total_points,
    count(*)::bigint as games
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  join public.profiles p on p.id = mp.profile_id
  where m.session_id = p_session_id
  group by mp.profile_id, p.display_name
  order by sum(mp.points_earned) desc, p.display_name;
$$;

grant execute on function public.get_competition_leaderboard(uuid) to authenticated;

create or replace function public._backfill_guest_match_players(p_roster_entry_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_row record;
  v_pts_a int;
  v_pts_b int;
  v_session public.game_sessions%rowtype;
  v_parts text[];
begin
  for v_row in
    select m.id as match_id, m.score_summary, crp.team, m.session_id
    from public.competition_round_players crp
    join public.matches m on m.competition_round_id = crp.round_id and m.court_id = crp.court_id
    where crp.roster_entry_id = p_roster_entry_id
      and not exists (
        select 1 from public.match_players mp
        where mp.match_id = m.id and mp.profile_id = p_profile_id
      )
  loop
    select * into v_session from public.game_sessions where id = v_row.session_id;

    if v_session.partnership_mode = 'americano' then
      v_parts := string_to_array(v_row.score_summary, '-');
      v_pts_a := v_parts[1]::int;
      v_pts_b := v_parts[2]::int;
      insert into public.match_players (match_id, profile_id, team, is_winner, points_earned)
      values (
        v_row.match_id,
        p_profile_id,
        v_row.team,
        (v_row.team = 'a' and v_pts_a > v_pts_b) or (v_row.team = 'b' and v_pts_b > v_pts_a),
        case when v_row.team = 'a' then v_pts_a else v_pts_b end
      );
    end if;
  end loop;
end;
$body$;

create or replace function public.link_guest_rosters_by_email()
returns int
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_email text;
  v_count int := 0;
  v_linked record;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null or v_email = '' then
    return 0;
  end if;

  for v_linked in
    update public.session_players sp
    set profile_id = auth.uid(), guest_name = null, guest_email = null
    where sp.profile_id is null
      and sp.guest_email is not null
      and lower(sp.guest_email) = v_email
      and not exists (
        select 1 from public.session_players x
        where x.session_id = sp.session_id and x.profile_id = auth.uid()
      )
    returning sp.id
  loop
    update public.competition_round_players
    set profile_id = auth.uid()
    where roster_entry_id = v_linked.id;

    perform public._backfill_guest_match_players(v_linked.id, auth.uid());
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$body$;
