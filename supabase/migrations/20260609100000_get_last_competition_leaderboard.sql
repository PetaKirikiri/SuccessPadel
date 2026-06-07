-- Home tab: standings from the most recently started competition.

create or replace function public.get_last_competition_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when gs.id is null then null
    else jsonb_build_object(
      'session', to_jsonb(gs),
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
  where gs.game_kind = 'competition'
    and gs.competition_started_at is not null
  order by gs.competition_started_at desc
  limit 1;
$$;

grant execute on function public.get_last_competition_leaderboard() to anon, authenticated;
