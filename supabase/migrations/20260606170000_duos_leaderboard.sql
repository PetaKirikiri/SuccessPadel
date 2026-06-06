-- Duos leaderboard: ranks pairs by combined match results in the active season.

create or replace function public.get_duos_leaderboard(p_season_id uuid default null)
returns table (
  rank bigint,
  player_a_id uuid,
  player_b_id uuid,
  display_name text,
  season_points bigint,
  level text,
  wins bigint,
  losses bigint,
  matches_played bigint,
  points_this_week bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with active_season as (
    select coalesce(
      p_season_id,
      (select s.id from public.seasons s where s.is_active limit 1)
    ) as id
  ),
  pair_matches as (
    select
      least(p1.profile_id, p2.profile_id) as player_a_id,
      greatest(p1.profile_id, p2.profile_id) as player_b_id,
      p1.is_winner,
      (p1.points_earned + p2.points_earned)::bigint as pair_points,
      gs.starts_on
    from public.match_players p1
    join public.match_players p2
      on p1.match_id = p2.match_id
      and p1.team = p2.team
      and p1.profile_id < p2.profile_id
    join public.matches m on m.id = p1.match_id
    join public.game_sessions gs on gs.id = m.session_id
    join active_season a on gs.season_id = a.id
  ),
  agg as (
    select
      pm.player_a_id,
      pm.player_b_id,
      sum(pm.pair_points)::bigint as season_points,
      count(*) filter (where pm.is_winner)::bigint as wins,
      count(*) filter (where not pm.is_winner)::bigint as losses,
      count(*)::bigint as matches_played,
      coalesce(sum(pm.pair_points) filter (
        where pm.starts_on >= date_trunc('week', current_date)::date
      ), 0)::bigint as points_this_week
    from pair_matches pm
    group by pm.player_a_id, pm.player_b_id
  ),
  ranked as (
    select
      row_number() over (
        order by a.season_points desc, pa.display_name, pb.display_name
      )::bigint as rank,
      a.player_a_id,
      a.player_b_id,
      pa.display_name || ' & ' || pb.display_name as display_name,
      a.season_points,
      case
        when a.season_points >= 100 then 'Elite'
        when a.season_points >= 50 then 'Advanced'
        when a.season_points >= 20 then 'Intermediate'
        else 'Beginner'
      end as level,
      a.wins,
      a.losses,
      a.matches_played,
      a.points_this_week
    from agg a
    join public.profiles pa on pa.id = a.player_a_id
    join public.profiles pb on pb.id = a.player_b_id
  )
  select * from ranked
  order by rank;
$$;

grant execute on function public.get_duos_leaderboard(uuid) to authenticated;
