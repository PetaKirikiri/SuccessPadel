-- Public (no-login) live competition page: curated read + open score submission.
-- Anonymous visitors get ONLY competition data through these definer RPCs;
-- no direct table access is granted to the anon role.

create or replace function public.get_public_competition(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when gs.game_kind <> 'competition' then null
    else jsonb_build_object(
      'session', to_jsonb(gs),
      'roster', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', sp.id,
          'profile_id', sp.profile_id,
          'guest_name', sp.guest_name,
          'rank_order', sp.rank_order,
          'profiles', case when pr.id is null then null
            else jsonb_build_object('id', pr.id, 'display_name', pr.display_name) end
        ) order by sp.rank_order nulls last, sp.id), '[]'::jsonb)
        from public.session_players sp
        left join public.profiles pr on pr.id = sp.profile_id
        where sp.session_id = gs.id
      ),
      'courts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'name', c.name, 'sort_order', c.sort_order
        ) order by c.sort_order), '[]'::jsonb)
        from public.courts c
        where c.is_active
      ),
      'rounds', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id,
          'session_id', r.session_id,
          'round_number', r.round_number,
          'is_final', r.is_final,
          'starts_at', r.starts_at,
          'ends_at', r.ends_at,
          'status', r.status,
          'competition_round_players', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'court_id', crp.court_id,
              'team', crp.team,
              'roster_entry_id', crp.roster_entry_id,
              'profile_id', crp.profile_id,
              'session_players', case when sp.id is null then null
                else jsonb_build_object(
                  'guest_name', sp.guest_name,
                  'profile_id', sp.profile_id,
                  'profiles', case when pr.id is null then null
                    else jsonb_build_object('id', pr.id, 'display_name', pr.display_name) end
                ) end,
              'courts', case when c.id is null then null
                else jsonb_build_object('id', c.id, 'name', c.name) end
            )), '[]'::jsonb)
            from public.competition_round_players crp
            left join public.session_players sp on sp.id = crp.roster_entry_id
            left join public.profiles pr on pr.id = sp.profile_id
            left join public.courts c on c.id = crp.court_id
            where crp.round_id = r.id
          )
        ) order by r.round_number), '[]'::jsonb)
        from public.competition_rounds r
        where r.session_id = gs.id
      ),
      'matches', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'competition_round_id', m.competition_round_id,
          'court_id', m.court_id,
          'score_summary', m.score_summary,
          'match_players', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'team', mp.team, 'is_winner', mp.is_winner
            )), '[]'::jsonb)
            from public.match_players mp
            where mp.match_id = m.id
          )
        )), '[]'::jsonb)
        from public.matches m
        where m.session_id = gs.id and m.competition_round_id is not null
      ),
      'leaderboard', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'profile_id', l.profile_id,
          'display_name', l.display_name,
          'total_points', l.total_points,
          'games', l.games
        )), '[]'::jsonb)
        from public.get_competition_leaderboard(gs.id) l
      )
    )
  end
  from public.game_sessions gs
  where gs.id = p_session_id;
$$;

grant execute on function public.get_public_competition(uuid) to anon, authenticated;

-- Open scoring: anyone with the link can submit a court score for a live competition.
alter table public.matches alter column created_by drop not null;

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
  if v_session.status <> 'locked' then
    raise exception 'Competition is not in progress';
  end if;
  if v_round.status not in ('active', 'complete') then
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

  select id into v_match_id
  from public.matches
  where competition_round_id = p_round_id and court_id = p_court_id;

  if v_match_id is null then
    insert into public.matches (
      session_id, score_summary, round_number, competition_round_id, court_id, created_by
    ) values (
      v_session.id, v_score, v_round.round_number, p_round_id, p_court_id, auth.uid()
    )
    returning id into v_match_id;
  else
    update public.matches
    set score_summary = v_score, created_by = auth.uid(), played_at = now()
    where id = v_match_id;
    delete from public.match_players where match_id = v_match_id;
  end if;

  for v_player in
    select sp.profile_id, crp.team, sp.id as roster_id
    from public.competition_round_players crp
    join public.session_players sp on sp.id = crp.roster_entry_id
    where crp.round_id = p_round_id and crp.court_id = p_court_id
  loop
    if v_player.profile_id is null then
      continue;
    end if;

    if v_session.partnership_mode = 'americano' then
      insert into public.match_players (match_id, profile_id, team, is_winner, points_earned)
      values (
        v_match_id,
        v_player.profile_id,
        v_player.team,
        (v_player.team = 'a' and v_pts_a > v_pts_b) or (v_player.team = 'b' and v_pts_b > v_pts_a),
        case when v_player.team = 'a' then v_pts_a else v_pts_b end
      );
    else
      insert into public.match_players (match_id, profile_id, team, is_winner, points_earned)
      values (
        v_match_id,
        v_player.profile_id,
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

  perform public.try_auto_advance_competition_round(v_session.id);

  return v_match_id;
end;
$body$;

grant execute on function public.record_competition_match(uuid, uuid, text, public.match_team, boolean, int, int) to anon, authenticated;
