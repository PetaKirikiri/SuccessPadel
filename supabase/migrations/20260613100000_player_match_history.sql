-- Public player match history for profile pages.

create or replace function public.get_player_match_history(p_player_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ids as (
    select
      case
        when exists (select 1 from public.profiles p where p.id = p_player_id) then p_player_id
        else (select pp.profile_id from public.padel_players pp where pp.id = p_player_id limit 1)
      end as profile_id,
      coalesce(
        (select pp.id from public.padel_players pp where pp.id = p_player_id),
        (select pp.id from public.padel_players pp where pp.profile_id = p_player_id limit 1)
      ) as padel_player_id
  ),
  player_matches as (
    select mp.match_id, mp.team, mp.is_winner, mp.points_earned
    from public.match_players mp
    cross join ids
    where (ids.profile_id is not null and mp.profile_id = ids.profile_id)
       or (ids.padel_player_id is not null and mp.padel_player_id = ids.padel_player_id)
  )
  select coalesce(
    jsonb_agg(entry order by played_at desc nulls last),
    '[]'::jsonb
  )
  from (
    select
      jsonb_build_object(
        'match_id', m.id,
        'played_at', m.played_at,
        'score_summary', m.score_summary,
        'session_title', gs.title,
        'round_number', cr.round_number,
        'court_name', c.name,
        'won', pm.is_winner,
        'points', pm.points_earned,
        'teammates', (
          select coalesce(
            string_agg(
              coalesce(pr.display_name, ppl.display_name, sp.guest_name, 'Player'),
              ' + ' order by coalesce(pr.display_name, ppl.display_name, sp.guest_name, 'Player')
            ),
            ''
          )
          from public.match_players omp
          cross join ids i2
          left join public.profiles pr on pr.id = omp.profile_id
          left join public.padel_players ppl on ppl.id = omp.padel_player_id
          left join public.session_players sp on sp.id = omp.roster_entry_id
          where omp.match_id = m.id
            and omp.team = pm.team
            and not (
              (i2.profile_id is not null and omp.profile_id = i2.profile_id)
              or (i2.padel_player_id is not null and omp.padel_player_id = i2.padel_player_id)
            )
        ),
        'opponents', (
          select coalesce(
            string_agg(
              coalesce(pr.display_name, ppl.display_name, sp.guest_name, 'Player'),
              ' + ' order by coalesce(pr.display_name, ppl.display_name, sp.guest_name, 'Player')
            ),
            ''
          )
          from public.match_players omp
          left join public.profiles pr on pr.id = omp.profile_id
          left join public.padel_players ppl on ppl.id = omp.padel_player_id
          left join public.session_players sp on sp.id = omp.roster_entry_id
          where omp.match_id = m.id and omp.team <> pm.team
        )
      ) as entry,
      m.played_at
    from player_matches pm
    join public.matches m on m.id = pm.match_id
    join public.game_sessions gs on gs.id = m.session_id
    left join public.competition_rounds cr on cr.id = m.competition_round_id
    left join public.courts c on c.id = m.court_id
  ) rows;
$$;

revoke all on function public.get_player_match_history(uuid) from public;
grant execute on function public.get_player_match_history(uuid) to anon, authenticated;
