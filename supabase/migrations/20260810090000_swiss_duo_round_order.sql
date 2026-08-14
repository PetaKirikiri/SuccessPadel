-- Eight fixed teams, six 14-minute rounds and four-minute changeovers.
--
-- The saved six-round round-robin pool guarantees that no team can meet the
-- same opponent twice. After each completed round, choose the unused pool
-- round whose matchups are closest to the current standings. This gives Swiss
-- ordering without risking a late-round rematch or an impossible pairing.

-- Current standings are ordered by games won, then game difference, opponent
-- strength and finally the original seeded team order.

create or replace function public.assign_swiss_duo_round(
  p_round_id uuid,
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_round_number int;
  v_schedule jsonb;
  v_ranked uuid[];
  v_played_keys text[];
  v_courts uuid[];
  v_candidate jsonb;
  v_best_round jsonb := null;
  v_match jsonb;
  v_team_a uuid;
  v_team_b uuid;
  v_roster uuid;
  v_match_key text;
  v_pairing_score int;
  v_best_score int := 2147483647;
  v_candidate_order int;
  v_best_order int := 2147483647;
  v_rank_a int;
  v_rank_b int;
  v_court_idx int;
  v_valid boolean;
  v_player_count int;
begin
  select * into v_session
  from public.game_sessions
  where id = p_session_id;

  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if coalesce(v_session.scoring_config->>'competition_player_mode', 'singles') <> 'duos' then
    raise exception 'Swiss team pairing is only available for duos';
  end if;
  if (select count(*) from public.session_pairs where session_id = p_session_id) <> 8 then
    raise exception 'Swiss team pairing requires exactly 8 teams';
  end if;

  select round_number into v_round_number
  from public.competition_rounds
  where id = p_round_id and session_id = p_session_id;
  if not found then
    raise exception 'Round not found';
  end if;

  v_schedule := v_session.scoring_config->'schedule';
  if v_schedule is null
    or jsonb_typeof(v_schedule) <> 'array'
    or jsonb_array_length(v_schedule) < 6 then
    raise exception 'Six-round duo schedule is missing';
  end if;

  -- Resolve the eight fixed teams into current standings. Points are the
  -- actual games scored by the team, read from the saved match score.
  with pair_seed as (
    select
      pair.id as pair_id,
      least(a.rank_order, b.rank_order) as seed_rank
    from public.session_pairs pair
    join public.session_players a on a.id = pair.roster_a_id
    join public.session_players b on b.id = pair.roster_b_id
    where pair.session_id = p_session_id
  ),
  completed_sides as (
    select
      round.id as round_id,
      round.round_number,
      crp.court_id,
      crp.team,
      array_agg(crp.roster_entry_id) as roster_ids
    from public.competition_rounds round
    join public.competition_round_players crp on crp.round_id = round.id
    where round.session_id = p_session_id
      and round.status = 'complete'
    group by round.id, round.round_number, crp.court_id, crp.team
  ),
  identified_sides as (
    select side.*, pair.id as pair_id
    from completed_sides side
    join public.session_pairs pair
      on pair.session_id = p_session_id
      and pair.roster_a_id = any(side.roster_ids)
      and pair.roster_b_id = any(side.roster_ids)
  ),
  played as (
    select
      a.pair_id as team_a,
      b.pair_id as team_b,
      split_part(saved_match.score_summary, '-', 1)::int as score_a,
      split_part(saved_match.score_summary, '-', 2)::int as score_b
    from identified_sides a
    join identified_sides b
      on b.round_id = a.round_id
      and b.court_id = a.court_id
      and b.team = 'b'
    join public.matches saved_match
      on saved_match.competition_round_id = a.round_id
      and saved_match.court_id = a.court_id
    where a.team = 'a'
      and saved_match.score_summary ~ '^[0-9]+-[0-9]+$'
  ),
  team_games as (
    select team_a as pair_id, team_b as opponent_id, score_a as games_for, score_b as games_against
    from played
    union all
    select team_b, team_a, score_b, score_a
    from played
  ),
  totals as (
    select
      seed.pair_id,
      seed.seed_rank,
      coalesce(sum(game.games_for), 0)::bigint as games_for,
      coalesce(sum(game.games_for - game.games_against), 0)::bigint as game_difference
    from pair_seed seed
    left join team_games game on game.pair_id = seed.pair_id
    group by seed.pair_id, seed.seed_rank
  ),
  standings as (
    select
      total.pair_id,
      total.seed_rank,
      total.games_for,
      total.game_difference,
      coalesce(sum(opponent.games_for), 0)::bigint as opponent_games
    from totals total
    left join team_games game on game.pair_id = total.pair_id
    left join totals opponent on opponent.pair_id = game.opponent_id
    group by total.pair_id, total.seed_rank, total.games_for, total.game_difference
  )
  select coalesce(
    array_agg(
      pair_id
      order by games_for desc, game_difference desc, opponent_games desc, seed_rank, pair_id
    ),
    '{}'::uuid[]
  )
  into v_ranked
  from standings;

  if cardinality(v_ranked) <> 8 then
    raise exception 'Could not rank all 8 teams';
  end if;

  -- Every completed opponent pairing becomes a hard exclusion.
  with completed_sides as (
    select
      round.id as round_id,
      crp.court_id,
      crp.team,
      array_agg(crp.roster_entry_id) as roster_ids
    from public.competition_rounds round
    join public.competition_round_players crp on crp.round_id = round.id
    where round.session_id = p_session_id
      and round.status = 'complete'
    group by round.id, crp.court_id, crp.team
  ),
  identified_sides as (
    select side.*, pair.id as pair_id
    from completed_sides side
    join public.session_pairs pair
      on pair.session_id = p_session_id
      and pair.roster_a_id = any(side.roster_ids)
      and pair.roster_b_id = any(side.roster_ids)
  )
  select coalesce(
    array_agg(
      least(a.pair_id::text, b.pair_id::text)
      || ':' ||
      greatest(a.pair_id::text, b.pair_id::text)
    ),
    '{}'::text[]
  )
  into v_played_keys
  from identified_sides a
  join identified_sides b
    on b.round_id = a.round_id
    and b.court_id = a.court_id
    and b.team = 'b'
  where a.team = 'a';

  -- Select the unused full round with the smallest squared rank gaps. Using
  -- a complete round from the saved round-robin pool is what guarantees that
  -- all four courts can be filled without any repeated opponent.
  for v_candidate in
    select value
    from jsonb_array_elements(v_schedule)
  loop
    v_pairing_score := 0;
    v_valid := true;
    v_candidate_order := coalesce((v_candidate->>'round')::int, 2147483647);

    if jsonb_typeof(v_candidate->'matches') <> 'array'
      or jsonb_array_length(v_candidate->'matches') <> 4 then
      continue;
    end if;

    for v_match in
      select value
      from jsonb_array_elements(v_candidate->'matches')
    loop
      select pair.id into v_team_a
      from public.session_pairs pair
      where pair.session_id = p_session_id
        and exists (
          select 1 from jsonb_array_elements_text(v_match->'team_a') roster
          where roster.value::uuid = pair.roster_a_id
        )
        and exists (
          select 1 from jsonb_array_elements_text(v_match->'team_a') roster
          where roster.value::uuid = pair.roster_b_id
        )
      limit 1;

      select pair.id into v_team_b
      from public.session_pairs pair
      where pair.session_id = p_session_id
        and exists (
          select 1 from jsonb_array_elements_text(v_match->'team_b') roster
          where roster.value::uuid = pair.roster_a_id
        )
        and exists (
          select 1 from jsonb_array_elements_text(v_match->'team_b') roster
          where roster.value::uuid = pair.roster_b_id
        )
      limit 1;

      v_rank_a := array_position(v_ranked, v_team_a);
      v_rank_b := array_position(v_ranked, v_team_b);
      if v_team_a is null or v_team_b is null or v_rank_a is null or v_rank_b is null then
        v_valid := false;
        exit;
      end if;

      v_match_key := least(v_team_a::text, v_team_b::text)
        || ':' || greatest(v_team_a::text, v_team_b::text);
      if v_match_key = any(v_played_keys) then
        v_valid := false;
        exit;
      end if;

      v_pairing_score := v_pairing_score + ((v_rank_a - v_rank_b) * (v_rank_a - v_rank_b));
    end loop;

    if v_valid and (
      v_pairing_score < v_best_score
      or (v_pairing_score = v_best_score and v_candidate_order < v_best_order)
    ) then
      v_best_round := v_candidate;
      v_best_score := v_pairing_score;
      v_best_order := v_candidate_order;
    end if;
  end loop;

  if v_best_round is null then
    raise exception 'No no-rematch Swiss pairing is available for round %', v_round_number;
  end if;

  select coalesce(array_agg(id order by sort_order), '{}'::uuid[])
  into v_courts
  from public.courts
  where is_active;

  if cardinality(v_courts) < 4 then
    raise exception 'Swiss team pairing requires 4 active courts';
  end if;

  delete from public.competition_round_players where round_id = p_round_id;

  for v_match in
    select value
    from jsonb_array_elements(v_best_round->'matches')
    order by (value->>'court')::int
  loop
    v_court_idx := coalesce((v_match->>'court')::int, 1);
    if v_court_idx < 1 or v_court_idx > 4 then
      raise exception 'Invalid court in saved duo schedule';
    end if;

    for v_roster in
      select value::uuid from jsonb_array_elements_text(v_match->'team_a')
    loop
      insert into public.competition_round_players (
        round_id, court_id, roster_entry_id, profile_id, team
      )
      select p_round_id, v_courts[v_court_idx], player.id, player.profile_id, 'a'
      from public.session_players player
      where player.id = v_roster and player.session_id = p_session_id;
    end loop;

    for v_roster in
      select value::uuid from jsonb_array_elements_text(v_match->'team_b')
    loop
      insert into public.competition_round_players (
        round_id, court_id, roster_entry_id, profile_id, team
      )
      select p_round_id, v_courts[v_court_idx], player.id, player.profile_id, 'b'
      from public.session_players player
      where player.id = v_roster and player.session_id = p_session_id;
    end loop;
  end loop;

  select count(*) into v_player_count
  from public.competition_round_players
  where round_id = p_round_id;
  if v_player_count <> 16 then
    raise exception 'Swiss team round must assign all 16 players';
  end if;
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
  v_session public.game_sessions%rowtype;
  v_pair_count int;
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
  where session_id = p_session_id
    and round_number = v_current.round_number + 1;

  if not found then
    update public.game_sessions
    set status = 'complete', competition_ended_at = now()
    where id = p_session_id;
    return;
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  select count(*) into v_pair_count
  from public.session_pairs
  where session_id = p_session_id;

  if coalesce(v_session.scoring_config->>'competition_player_mode', 'singles') = 'duos'
    and v_pair_count = 8
    and v_session.schedule_game_count = 6 then
    perform public.assign_swiss_duo_round(v_next.id, p_session_id);
  else
    perform public.assign_competition_round(v_next.id, p_session_id);
  end if;

  update public.competition_rounds
  set status = 'active'
  where id = v_next.id;
end;
$body$;

comment on function public.assign_swiss_duo_round(uuid, uuid) is
  'Chooses the closest-standing unused matchup round for an 8-team, 6-round fixed-duo competition.';

notify pgrst, 'reload schema';
