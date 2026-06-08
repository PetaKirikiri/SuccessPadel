-- Allow score entry for any scheduled game round, not only the clock-active one.

create or replace function public.record_competition_match(
  p_round_id uuid,
  p_court_id uuid,
  p_score_summary text,
  p_winner_team public.match_team,
  p_margin_bonus boolean default false,
  p_team_a_points int default null,
  p_team_b_points int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_round public.competition_rounds%rowtype;
  v_session public.game_sessions%rowtype;
  v_match_id uuid;
  v_player record;
  v_score text;
  v_pts_a int;
  v_pts_b int;
begin
  select * into v_round from public.competition_rounds where id = p_round_id;
  if not found then
    raise exception 'Round not found';
  end if;

  select * into v_session from public.game_sessions where id = v_round.session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status not in ('locked', 'complete') then
    raise exception 'Competition is not in progress';
  end if;
  if v_round.status not in ('pending', 'active', 'complete') then
    raise exception 'Round is not open for scoring';
  end if;

  if (select count(*) from public.competition_round_players
      where round_id = p_round_id and court_id = p_court_id) <> 4 then
    raise exception 'Court must have 4 players';
  end if;

  if v_session.partnership_mode = 'americano' then
    if p_team_a_points is null or p_team_b_points is null then
      raise exception 'Team points required for Americano';
    end if;
    if p_team_a_points < 0 or p_team_b_points < 0 then
      raise exception 'Invalid points';
    end if;
    v_pts_a := p_team_a_points;
    v_pts_b := p_team_b_points;
    v_score := v_pts_a::text || '-' || v_pts_b::text;
  else
    v_score := btrim(p_score_summary);
    if v_score = '' then
      raise exception 'Score required';
    end if;
  end if;

  insert into public.matches (
    session_id, score_summary, round_number, competition_round_id, court_id, created_by, played_at
  ) values (
    v_session.id, v_score, v_round.round_number, p_round_id, p_court_id, auth.uid(), now()
  )
  on conflict (competition_round_id, court_id)
    where competition_round_id is not null and court_id is not null
  do update set
    score_summary = excluded.score_summary,
    created_by = excluded.created_by,
    played_at = now()
  returning id into v_match_id;

  delete from public.match_players where match_id = v_match_id;

  for v_player in
    select sp.profile_id, crp.team, sp.id as roster_id, sp.padel_player_id
    from public.competition_round_players crp
    join public.session_players sp on sp.id = crp.roster_entry_id
    where crp.round_id = p_round_id and crp.court_id = p_court_id
  loop
    if v_session.partnership_mode = 'americano' then
      if v_player.profile_id is not null then
        insert into public.match_players (match_id, profile_id, padel_player_id, team, is_winner, points_earned)
        values (
          v_match_id,
          v_player.profile_id,
          coalesce(
            v_player.padel_player_id,
            public.find_or_create_padel_player(
              (select display_name from public.profiles where id = v_player.profile_id),
              null,
              v_player.profile_id
            )
          ),
          v_player.team,
          (v_player.team = 'a' and v_pts_a > v_pts_b) or (v_player.team = 'b' and v_pts_b > v_pts_a),
          case when v_player.team = 'a' then v_pts_a else v_pts_b end
        );
      else
        insert into public.match_players (match_id, roster_entry_id, padel_player_id, team, is_winner, points_earned)
        values (
          v_match_id,
          v_player.roster_id,
          coalesce(
            v_player.padel_player_id,
            public.find_or_create_padel_player(
              (select guest_name from public.session_players where id = v_player.roster_id),
              (select guest_email from public.session_players where id = v_player.roster_id),
              null
            )
          ),
          v_player.team,
          (v_player.team = 'a' and v_pts_a > v_pts_b) or (v_player.team = 'b' and v_pts_b > v_pts_a),
          case when v_player.team = 'a' then v_pts_a else v_pts_b end
        );
      end if;
    elsif v_player.profile_id is not null then
      insert into public.match_players (match_id, profile_id, padel_player_id, team, is_winner, points_earned)
      values (
        v_match_id,
        v_player.profile_id,
        coalesce(
          v_player.padel_player_id,
          public.find_or_create_padel_player(
            (select display_name from public.profiles where id = v_player.profile_id),
            null,
            v_player.profile_id
          )
        ),
        v_player.team,
        v_player.team = p_winner_team,
        public.compute_player_points(
          v_session.scoring_preset,
          v_session.scoring_config,
          v_session.margin_bonus_enabled,
          v_player.team = p_winner_team,
          p_margin_bonus and v_player.team = p_winner_team
        )
      );
    else
      insert into public.match_players (match_id, roster_entry_id, padel_player_id, team, is_winner, points_earned)
      values (
        v_match_id,
        v_player.roster_id,
        coalesce(
          v_player.padel_player_id,
          public.find_or_create_padel_player(
            (select guest_name from public.session_players where id = v_player.roster_id),
            (select guest_email from public.session_players where id = v_player.roster_id),
            null
          )
        ),
        v_player.team,
        v_player.team = p_winner_team,
        public.compute_player_points(
          v_session.scoring_preset,
          v_session.scoring_config,
          v_session.margin_bonus_enabled,
          v_player.team = p_winner_team,
          p_margin_bonus and v_player.team = p_winner_team
        )
      );
    end if;
  end loop;

  if v_session.status = 'locked' then
    perform public.try_auto_advance_competition_round(v_session.id);
  end if;

  return v_match_id;
end;
$body$;
