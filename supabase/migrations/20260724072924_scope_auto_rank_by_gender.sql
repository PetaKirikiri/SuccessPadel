drop function if exists public.auto_rank_competition_roster(jsonb);

-- Division-specific ranking: Mixed setup only consumes Mixed history, and the
-- same rule applies to Men and Women divisions.
create function public.auto_rank_competition_roster(
  p_players jsonb,
  p_gender text
)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    where public.is_admin()
      and lower(trim(p_gender)) in ('men', 'women', 'mixed')
  ),
  input_players as (
    select
      p.slot_index,
      p.profile_id,
      p.padel_player_id,
      coalesce(p.profile_id, linked.profile_id) as resolved_profile_id
    from authorized
    cross join jsonb_to_recordset(coalesce(p_players, '[]'::jsonb)) as p(
      slot_index int,
      profile_id uuid,
      padel_player_id uuid
    )
    left join public.padel_players linked on linked.id = p.padel_player_id
  ),
  eligible_sessions as (
    select gs.id
    from public.game_sessions gs
    where gs.game_kind = 'competition'
      and gs.status = 'complete'
      and lower(trim(gs.gender)) = lower(trim(p_gender))
  ),
  placed_results as (
    select
      es.id as session_id,
      l.member_profile_id,
      l.padel_player_id,
      count(*) over (partition by es.id)::int as field_size,
      rank() over (
        partition by es.id
        order by l.total_points desc
      )::int as finish_position
    from eligible_sessions es
    cross join lateral public.get_competition_leaderboard(es.id) l
    where l.games > 0
  ),
  player_history as (
    select
      ip.slot_index,
      count(distinct pr.session_id)::int as competitions,
      coalesce(sum(pr.field_size - pr.finish_position + 1), 0)::int as ranking_points
    from input_players ip
    left join placed_results pr
      on (
        ip.resolved_profile_id is not null
        and pr.member_profile_id = ip.resolved_profile_id
      )
      or (
        ip.padel_player_id is not null
        and pr.padel_player_id = ip.padel_player_id
      )
    group by ip.slot_index
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'slot_index', ph.slot_index,
        'ranking_points', ph.ranking_points,
        'competitions', ph.competitions
      )
      order by
        (ph.competitions > 0) desc,
        ph.ranking_points desc,
        random()
    ),
    '[]'::jsonb
  )
  from player_history ph;
$$;

revoke all on function public.auto_rank_competition_roster(jsonb, text) from public;
grant execute on function public.auto_rank_competition_roster(jsonb, text) to authenticated;
