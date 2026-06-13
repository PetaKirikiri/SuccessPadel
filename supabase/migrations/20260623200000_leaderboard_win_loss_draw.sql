-- Add wins, losses, and draws to competition and season leaderboard RPCs.

drop function if exists public.get_competition_leaderboard(uuid);

create or replace function public.get_competition_leaderboard(p_session_id uuid)
returns table (
  profile_id uuid,
  padel_player_id uuid,
  member_profile_id uuid,
  is_guest boolean,
  display_name text,
  avatar_url text,
  total_points bigint,
  games bigint,
  wins bigint,
  losses bigint,
  draws bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with player_results as (
    select
      coalesce(mp.profile_id, mp.padel_player_id, mp.roster_entry_id) as player_key,
      mp.padel_player_id,
      mp.profile_id,
      mp.roster_entry_id,
      mp.profile_id is null as is_guest_row,
      mp.points_earned,
      coalesce(opp.max_opp_points, 0) as opp_points
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    left join lateral (
      select max(o.points_earned) as max_opp_points
      from public.match_players o
      where o.match_id = mp.match_id
        and o.team is distinct from mp.team
    ) opp on true
    where m.session_id = p_session_id
  )
  select
    pr.player_key as profile_id,
    (max(pr.padel_player_id::text))::uuid as padel_player_id,
    (max(pr.profile_id::text))::uuid as member_profile_id,
    bool_and(pr.is_guest_row) as is_guest,
    coalesce(
      p.display_name,
      pp.line_display_name,
      pp.display_name,
      sp.guest_name,
      'Player'
    ) as display_name,
    coalesce(max(p.avatar_url), max(pp.line_picture_url)) as avatar_url,
    coalesce(sum(pr.points_earned), 0)::bigint as total_points,
    count(*)::bigint as games,
    count(*) filter (where pr.points_earned > pr.opp_points)::bigint as wins,
    count(*) filter (where pr.points_earned < pr.opp_points)::bigint as losses,
    count(*) filter (where pr.points_earned = pr.opp_points)::bigint as draws
  from player_results pr
  left join public.profiles p on p.id = pr.profile_id
  left join public.padel_players pp on pp.id = pr.padel_player_id
  left join public.session_players sp on sp.id = pr.roster_entry_id
  group by
    pr.player_key,
    coalesce(
      p.display_name,
      pp.line_display_name,
      pp.display_name,
      sp.guest_name,
      'Player'
    )
  order by sum(pr.points_earned) desc, coalesce(
    p.display_name,
    pp.line_display_name,
    pp.display_name,
    sp.guest_name,
    'Player'
  );
$$;

grant execute on function public.get_competition_leaderboard(uuid) to anon, authenticated;

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
          'profile_id', coalesce(sp.profile_id, pp.profile_id),
          'padel_player_id', sp.padel_player_id,
          'guest_name', sp.guest_name,
          'rank_order', sp.rank_order,
          'profiles', case
            when pr.id is not null then jsonb_build_object(
              'id', pr.id,
              'display_name', pr.display_name,
              'avatar_url', coalesce(pr.avatar_url, pp.line_picture_url)
            )
            when pp.line_picture_url is not null or pp.line_display_name is not null then jsonb_build_object(
              'id', coalesce(pp.profile_id, pp.id),
              'display_name', coalesce(pp.line_display_name, sp.guest_name),
              'avatar_url', pp.line_picture_url
            )
            else null
          end
        ) order by sp.rank_order nulls last, sp.id), '[]'::jsonb)
        from public.session_players sp
        left join public.profiles pr on pr.id = sp.profile_id
        left join public.padel_players pp on pp.id = sp.padel_player_id
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
              'profile_id', coalesce(crp.profile_id, pp2.profile_id),
              'padel_player_id', sp.padel_player_id,
              'session_players', case when sp.id is null then null
                else jsonb_build_object(
                  'guest_name', sp.guest_name,
                  'profile_id', coalesce(sp.profile_id, pp2.profile_id),
                  'padel_player_id', sp.padel_player_id,
                  'profiles', case
                    when pr.id is not null then jsonb_build_object(
                      'id', pr.id,
                      'display_name', pr.display_name,
                      'avatar_url', coalesce(pr.avatar_url, pp2.line_picture_url)
                    )
                    when pp2.line_picture_url is not null or pp2.line_display_name is not null then jsonb_build_object(
                      'id', coalesce(pp2.profile_id, pp2.id),
                      'display_name', coalesce(pp2.line_display_name, sp.guest_name),
                      'avatar_url', pp2.line_picture_url
                    )
                    else null
                  end
                ) end,
              'courts', case when c.id is null then null
                else jsonb_build_object('id', c.id, 'name', c.name) end
            )), '[]'::jsonb)
            from public.competition_round_players crp
            left join public.session_players sp on sp.id = crp.roster_entry_id
            left join public.profiles pr on pr.id = sp.profile_id
            left join public.padel_players pp2 on pp2.id = sp.padel_player_id
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
          'played_at', m.played_at,
          'match_players', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'team', mp.team, 'is_winner', mp.is_winner,
              'padel_player_id', mp.padel_player_id
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
          'padel_player_id', l.padel_player_id,
          'member_profile_id', l.member_profile_id,
          'is_guest', l.is_guest,
          'display_name', l.display_name,
          'avatar_url', l.avatar_url,
          'total_points', l.total_points,
          'games', l.games,
          'wins', l.wins,
          'losses', l.losses,
          'draws', l.draws
        )), '[]'::jsonb)
        from public.get_competition_leaderboard(gs.id) l
      )
    )
  end
  from public.game_sessions gs
  where gs.id = p_session_id;
$$;

grant execute on function public.get_public_competition(uuid) to anon, authenticated;

create or replace function public.get_season_competition_leaderboard(
  p_season_id uuid default null,
  p_gender text default null,
  p_skill_level text default null,
  p_rank_mode text default 'solo'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with active_season as (
    select s.id, s.name, s.starts_on, s.ends_on
    from public.seasons s
    where s.id = coalesce(
      p_season_id,
      (select id from public.seasons where is_active limit 1)
    )
  ),
  season_sessions as (
    select gs.id
    from public.game_sessions gs
    join active_season a on gs.season_id = a.id
    where gs.game_kind = 'competition'
      and gs.competition_started_at is not null
      and gs.counts_in_season_leaderboard = true
      and (p_gender is null or gs.gender = p_gender)
      and (p_skill_level is null or gs.skill_level = p_skill_level)
  ),
  friendly_season_sessions as (
    select fs.id
    from public.friendly_sessions fs
    join active_season a on true
    where fs.play_mode = 'organized'
      and fs.visibility = 'public'
      and coalesce(nullif(btrim(fs.organized_config->>'skillLevel'), ''), '') <> ''
      and coalesce(nullif(btrim(fs.organized_config->>'gender'), ''), '') <> ''
      and (p_gender is null or fs.organized_config->>'gender' = p_gender)
      and (p_skill_level is null or fs.organized_config->>'skillLevel' = p_skill_level)
      and coalesce(
        (fs.organized_config->>'day')::date,
        (fs.created_at at time zone 'Asia/Bangkok')::date
      ) >= a.starts_on
      and coalesce(
        (fs.organized_config->>'day')::date,
        (fs.created_at at time zone 'Asia/Bangkok')::date
      ) <= coalesce(a.ends_on, '9999-12-31'::date)
  ),
  latest_friendly_logs as (
    select distinct on (mgl.court_setup_key)
      mgl.court_setup_key,
      mgl.friendly_session_id,
      mgl.final_score,
      mgl.roster
    from public.match_gesture_logs mgl
    join friendly_season_sessions fss on fss.id = mgl.friendly_session_id
    where mgl.match_ended_at is not null
      and mgl.winner is not null
    order by mgl.court_setup_key, mgl.updated_at desc
  ),
  friendly_roster_points as (
    select
      l.court_setup_key,
      coalesce(
        nullif(elem->>'playerId', ''),
        nullif(btrim(elem->>'name'), '')
      ) as player_key,
      case
        when nullif(elem->>'playerId', '') ~* '^[0-9a-f-]{36}$'
        then (elem->>'playerId')::uuid
        else null
      end as member_profile_id,
      elem->>'name' as slot_name,
      case
        when elem->>'quadrant' in ('TL', 'TR')
        then coalesce((l.final_score->>'gamesA')::int, (l.final_score->>'pointsA')::int, 0)
        else coalesce((l.final_score->>'gamesB')::int, (l.final_score->>'pointsB')::int, 0)
      end as points_earned,
      case
        when elem->>'quadrant' in ('TL', 'TR')
        then coalesce((l.final_score->>'gamesB')::int, (l.final_score->>'pointsB')::int, 0)
        else coalesce((l.final_score->>'gamesA')::int, (l.final_score->>'pointsA')::int, 0)
      end as opp_score
    from latest_friendly_logs l
    cross join lateral jsonb_array_elements(l.roster) as elem
    where coalesce(
      nullif(elem->>'playerId', ''),
      nullif(btrim(elem->>'name'), '')
    ) is not null
  ),
  friendly_player_totals as (
    select
      coalesce(fpp.member_profile_id::text, fpp.player_key) as player_key,
      null::uuid as padel_player_id,
      fpp.member_profile_id,
      (fpp.member_profile_id is null) as is_guest,
      coalesce(max(p.display_name), max(nullif(btrim(fpp.slot_name), '')), 'Player') as display_name,
      coalesce(max(p.avatar_url), max(pp.line_picture_url)) as avatar_url,
      coalesce(sum(fpp.points_earned), 0)::bigint as total_points,
      count(distinct fpp.court_setup_key)::bigint as games,
      count(distinct fpp.court_setup_key) filter (where fpp.points_earned > fpp.opp_score)::bigint as wins,
      count(distinct fpp.court_setup_key) filter (where fpp.points_earned < fpp.opp_score)::bigint as losses,
      count(distinct fpp.court_setup_key) filter (where fpp.points_earned = fpp.opp_score)::bigint as draws
    from friendly_roster_points fpp
    left join public.profiles p on p.id = fpp.member_profile_id
    left join public.padel_players pp on pp.profile_id = fpp.member_profile_id
    group by coalesce(fpp.member_profile_id::text, fpp.player_key), fpp.member_profile_id
  ),
  competition_player_results as (
    select
      coalesce(mp.profile_id, mp.padel_player_id, mp.roster_entry_id)::text as player_key,
      mp.padel_player_id,
      mp.profile_id,
      mp.roster_entry_id,
      mp.profile_id is null as is_guest_row,
      mp.points_earned,
      coalesce(opp.max_opp_points, 0) as opp_points
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    join season_sessions ss on m.session_id = ss.id
    left join lateral (
      select max(o.points_earned) as max_opp_points
      from public.match_players o
      where o.match_id = mp.match_id
        and o.team is distinct from mp.team
    ) opp on true
    where coalesce(p_rank_mode, 'solo') = 'solo'
  ),
  player_totals as (
    select
      cpr.player_key,
      (max(cpr.padel_player_id::text))::uuid as padel_player_id,
      (max(cpr.profile_id::text))::uuid as member_profile_id,
      bool_and(cpr.is_guest_row) as is_guest,
      coalesce(max(p.display_name), max(pp.line_display_name), max(pp.display_name), max(sp.guest_name), 'Player') as display_name,
      coalesce(max(p.avatar_url), max(pp.line_picture_url)) as avatar_url,
      coalesce(sum(cpr.points_earned), 0)::bigint as total_points,
      count(*)::bigint as games,
      count(*) filter (where cpr.points_earned > cpr.opp_points)::bigint as wins,
      count(*) filter (where cpr.points_earned < cpr.opp_points)::bigint as losses,
      count(*) filter (where cpr.points_earned = cpr.opp_points)::bigint as draws
    from competition_player_results cpr
    left join public.profiles p on p.id = cpr.profile_id
    left join public.padel_players pp on pp.id = cpr.padel_player_id
    left join public.session_players sp on sp.id = cpr.roster_entry_id
    group by cpr.player_key
  ),
  merged_solo_totals as (
    select
      combined.player_key,
      (max(combined.padel_player_id::text))::uuid as padel_player_id,
      (max(combined.member_profile_id::text))::uuid as member_profile_id,
      bool_and(combined.is_guest) as is_guest,
      coalesce(
        max(combined.display_name) filter (where combined.member_profile_id is not null),
        max(combined.display_name)
      ) as display_name,
      max(combined.avatar_url) as avatar_url,
      sum(combined.total_points)::bigint as total_points,
      sum(combined.games)::bigint as games,
      sum(combined.wins)::bigint as wins,
      sum(combined.losses)::bigint as losses,
      sum(combined.draws)::bigint as draws
    from (
      select * from player_totals
      union all
      select * from friendly_player_totals
    ) combined
    group by combined.player_key
  ),
  duo_match_pairs as (
    select
      least(
        coalesce(p1.profile_id, p1.padel_player_id, p1.roster_entry_id)::text,
        coalesce(p2.profile_id, p2.padel_player_id, p2.roster_entry_id)::text
      ) as key_a,
      greatest(
        coalesce(p1.profile_id, p1.padel_player_id, p1.roster_entry_id)::text,
        coalesce(p2.profile_id, p2.padel_player_id, p2.roster_entry_id)::text
      ) as key_b,
      p1.match_id,
      (p1.points_earned + p2.points_earned) as team_points,
      coalesce(opp.opp_points, 0) as opp_points
    from public.match_players p1
    join public.match_players p2
      on p1.match_id = p2.match_id
      and p1.team = p2.team
      and coalesce(p1.profile_id, p1.padel_player_id, p1.roster_entry_id)::text
        < coalesce(p2.profile_id, p2.padel_player_id, p2.roster_entry_id)::text
    join public.matches m on m.id = p1.match_id
    join season_sessions ss on m.session_id = ss.id
    left join lateral (
      select sum(o.points_earned) as opp_points
      from public.match_players o
      where o.match_id = p1.match_id
        and o.team is distinct from p1.team
    ) opp on true
    where coalesce(p_rank_mode, 'solo') = 'duos'
  ),
  duo_totals as (
    select
      key_a,
      key_b,
      coalesce(sum(team_points), 0)::bigint as total_points,
      count(*)::bigint as games,
      count(*) filter (where team_points > opp_points)::bigint as wins,
      count(*) filter (where team_points < opp_points)::bigint as losses,
      count(*) filter (where team_points = opp_points)::bigint as draws
    from duo_match_pairs
    group by key_a, key_b
    order by sum(team_points) desc
  ),
  duo_rows as (
    select
      'duo:' || dt.key_a || ':' || dt.key_b as profile_id,
      null::uuid as padel_player_id,
      null::uuid as member_profile_id,
      false as is_guest,
      coalesce(pa.display_name, ppa.display_name, spa.guest_name, 'Player')
        || ' & '
        || coalesce(pb.display_name, ppb.display_name, spb.guest_name, 'Player') as display_name,
      pa.avatar_url as avatar_url,
      dt.total_points,
      dt.games,
      dt.wins,
      dt.losses,
      dt.draws,
      case when dt.key_a ~* '^[0-9a-f-]{36}$' then dt.key_a::uuid else null end as player_a_id,
      case when dt.key_b ~* '^[0-9a-f-]{36}$' then dt.key_b::uuid else null end as player_b_id
    from duo_totals dt
    left join public.profiles pa on pa.id::text = dt.key_a
    left join public.profiles pb on pb.id::text = dt.key_b
    left join public.padel_players ppa on ppa.id::text = dt.key_a
    left join public.padel_players ppb on ppb.id::text = dt.key_b
    left join public.session_players spa on spa.id::text = dt.key_a
    left join public.session_players spb on spb.id::text = dt.key_b
  ),
  leaderboard_rows as (
    select
      pt.player_key as profile_id,
      pt.padel_player_id,
      pt.member_profile_id,
      pt.is_guest,
      pt.display_name,
      pt.avatar_url,
      pt.total_points,
      pt.games,
      pt.wins,
      pt.losses,
      pt.draws,
      null::uuid as player_a_id,
      null::uuid as player_b_id
    from merged_solo_totals pt
    where coalesce(p_rank_mode, 'solo') = 'solo'

    union all

    select
      dr.profile_id,
      dr.padel_player_id,
      dr.member_profile_id,
      dr.is_guest,
      dr.display_name,
      dr.avatar_url,
      dr.total_points,
      dr.games,
      dr.wins,
      dr.losses,
      dr.draws,
      dr.player_a_id,
      dr.player_b_id
    from duo_rows dr
    where coalesce(p_rank_mode, 'solo') = 'duos'
  )
  select case
    when a.id is null then null
    else jsonb_build_object(
      'season', jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'starts_on', a.starts_on,
        'ends_on', a.ends_on,
        'weeks_total', 10,
        'weeks_left', greatest(0, 10 - ((current_date - a.starts_on) / 7))
      ),
      'leaderboard', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'profile_id', lr.profile_id,
          'padel_player_id', lr.padel_player_id,
          'member_profile_id', lr.member_profile_id,
          'is_guest', lr.is_guest,
          'display_name', lr.display_name,
          'avatar_url', lr.avatar_url,
          'total_points', lr.total_points,
          'games', lr.games,
          'wins', lr.wins,
          'losses', lr.losses,
          'draws', lr.draws,
          'player_a_id', lr.player_a_id,
          'player_b_id', lr.player_b_id
        ) order by lr.total_points desc, lr.display_name), '[]'::jsonb)
        from leaderboard_rows lr
      ),
      'has_live_competition', exists (
        select 1
        from public.game_sessions gs
        where gs.season_id = a.id
          and gs.game_kind = 'competition'
          and gs.competition_started_at is not null
          and gs.status <> 'complete'
          and gs.counts_in_season_leaderboard = true
      )
    )
  end
  from active_season a;
$$;

grant execute on function public.get_season_competition_leaderboard(uuid, text, text, text) to anon, authenticated;
