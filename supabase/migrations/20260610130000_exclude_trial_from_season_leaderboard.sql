-- Trial competition scores should not appear on the public Season 1 home leaderboard.

alter table public.game_sessions
  add column if not exists counts_in_season_leaderboard boolean not null default true;

update public.game_sessions
set counts_in_season_leaderboard = false
where id = 'ea13ffab-a82d-49be-8c08-ed04a9fc4a29';

create or replace function public.get_season_competition_leaderboard(p_season_id uuid default null)
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
    group by coalesce(mp.profile_id, mp.padel_player_id, mp.roster_entry_id)
    order by sum(mp.points_earned) desc, coalesce(max(p.display_name), max(pp.display_name), max(sp.guest_name), 'Player')
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
          'profile_id', pt.player_key,
          'padel_player_id', pt.padel_player_id,
          'member_profile_id', pt.member_profile_id,
          'is_guest', pt.is_guest,
          'display_name', pt.display_name,
          'avatar_url', pt.avatar_url,
          'total_points', pt.total_points,
          'games', pt.games
        )), '[]'::jsonb)
        from player_totals pt
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
