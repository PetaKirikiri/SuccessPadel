-- Season competition leaderboard: filter by gender, skill level, solo vs duos.

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
      and (p_gender is null or gs.gender = p_gender)
      and (p_skill_level is null or gs.skill_level = p_skill_level)
  ),
  player_totals as (
    select
      coalesce(mp.profile_id, mp.padel_player_id, mp.roster_entry_id) as player_key,
      (max(mp.padel_player_id::text))::uuid as padel_player_id,
      (max(mp.profile_id::text))::uuid as member_profile_id,
      bool_and(mp.profile_id is null) as is_guest,
      coalesce(max(p.display_name), max(pp.display_name), max(sp.guest_name), 'Player') as display_name,
      max(p.avatar_url) as avatar_url,
      coalesce(sum(mp.points_earned), 0)::bigint as total_points,
      count(*)::bigint as games
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    join season_sessions ss on m.session_id = ss.id
    left join public.profiles p on p.id = mp.profile_id
    left join public.padel_players pp on pp.id = mp.padel_player_id
    left join public.session_players sp on sp.id = mp.roster_entry_id
    where coalesce(p_rank_mode, 'solo') = 'solo'
    group by coalesce(mp.profile_id, mp.padel_player_id, mp.roster_entry_id)
    order by sum(mp.points_earned) desc, coalesce(max(p.display_name), max(pp.display_name), max(sp.guest_name), 'Player')
  ),
  duo_totals as (
    select
      least(
        coalesce(p1.profile_id, p1.padel_player_id, p1.roster_entry_id)::text,
        coalesce(p2.profile_id, p2.padel_player_id, p2.roster_entry_id)::text
      ) as key_a,
      greatest(
        coalesce(p1.profile_id, p1.padel_player_id, p1.roster_entry_id)::text,
        coalesce(p2.profile_id, p2.padel_player_id, p2.roster_entry_id)::text
      ) as key_b,
      coalesce(sum(p1.points_earned + p2.points_earned), 0)::bigint as total_points,
      count(*)::bigint as games
    from public.match_players p1
    join public.match_players p2
      on p1.match_id = p2.match_id
      and p1.team = p2.team
      and coalesce(p1.profile_id, p1.padel_player_id, p1.roster_entry_id)::text
        < coalesce(p2.profile_id, p2.padel_player_id, p2.roster_entry_id)::text
    join public.matches m on m.id = p1.match_id
    join season_sessions ss on m.session_id = ss.id
    where coalesce(p_rank_mode, 'solo') = 'duos'
    group by key_a, key_b
    order by sum(p1.points_earned + p2.points_earned) desc
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
      pt.player_key::text as profile_id,
      pt.padel_player_id,
      pt.member_profile_id,
      pt.is_guest,
      pt.display_name,
      pt.avatar_url,
      pt.total_points,
      pt.games,
      null::uuid as player_a_id,
      null::uuid as player_b_id
    from player_totals pt
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
      )
    )
  end
  from active_season a;
$$;

grant execute on function public.get_season_competition_leaderboard(uuid, text, text, text) to anon, authenticated;
