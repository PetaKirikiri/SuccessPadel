-- Restore Peta's deleted Trial roster slot and 8 missing match_player rows.

do $$
declare
  v_session_id uuid := 'ea13ffab-a82d-49be-8c08-ed04a9fc4a29';
  v_profile_id uuid := '7bdc33ac-7f21-4ebf-bfbf-343080724890';
  v_roster_id uuid := '549db5fa-1623-473b-9d3a-665798a1de52';
  v_padel_id uuid := '57e78f89-005f-4518-b00d-65e525183d14';
  v_court1 uuid := '5a2ad18d-f129-4e1e-be2d-c7eb7b376f2a';
  v_court2 uuid := '38ba6837-6c82-47d4-a51c-66de88bca292';
  v_court3 uuid := '0bd04186-bebf-4703-85d4-f95491444c74';
begin
  insert into public.session_players (
    id, session_id, guest_name, profile_id, padel_player_id, rank_order
  )
  values (
    v_roster_id, v_session_id, null, v_profile_id, v_padel_id, 8
  )
  on conflict (id) do update
  set guest_name = null,
      profile_id = v_profile_id,
      padel_player_id = v_padel_id,
      rank_order = 8;

  insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
  select v.round_id, v.court_id, v_roster_id, v_profile_id, v.team
  from (values
    ('9d1b6ff6-fac6-4454-b25c-fb693dfd484e'::uuid, v_court2, 'a'::public.match_team),
    ('10da48d1-8044-4a4f-a233-da93e05e0177'::uuid, v_court1, 'b'::public.match_team),
    ('c134781a-1f77-4f17-8a22-68a7ade7d597'::uuid, v_court1, 'b'::public.match_team),
    ('8a7b9f63-d257-49a5-a692-90e9b3b00741'::uuid, v_court3, 'a'::public.match_team),
    ('3f3faae4-9627-4a92-841e-c2e3cf980d54'::uuid, v_court2, 'a'::public.match_team),
    ('15e3a45a-9924-4859-ab29-d0ba68e90561'::uuid, v_court3, 'b'::public.match_team),
    ('85549853-ac7f-4228-bbeb-eb3ac9ce4782'::uuid, v_court1, 'b'::public.match_team),
    ('ad04624d-a191-4985-bb47-04df2dc01e12'::uuid, v_court1, 'b'::public.match_team)
  ) as v(round_id, court_id, team)
  on conflict (round_id, roster_entry_id) do update
  set court_id = excluded.court_id,
      profile_id = excluded.profile_id,
      team = excluded.team;

  insert into public.match_players (
    match_id, profile_id, padel_player_id, roster_entry_id, team, is_winner, points_earned
  )
  select v.match_id, v_profile_id, v_padel_id, v_roster_id, v.team, v.is_winner, v.points
  from (values
    ('fb22900d-e1ef-4837-aee7-1c9a26945a3f'::uuid, 'a'::public.match_team, true, 4),
    ('4a5a58d1-39b1-4cb6-afd7-f4e7630abfa4'::uuid, 'b'::public.match_team, true, 3),
    ('ba616205-bfce-45a6-8041-31611ee1ea3d'::uuid, 'b'::public.match_team, false, 1),
    ('a17338b7-49f2-45c9-be73-e4f8ae7bc49a'::uuid, 'a'::public.match_team, false, 1),
    ('ef8ffaaa-9bdb-416a-a2eb-85b28e252ffd'::uuid, 'a'::public.match_team, false, 0),
    ('c755b171-5050-4f0e-aebc-7bb7c5de600c'::uuid, 'b'::public.match_team, true, 2),
    ('9710add5-80d9-4e6b-abc0-71485c571f39'::uuid, 'b'::public.match_team, true, 4),
    ('22b1c322-e1f1-4cfa-bc26-a6ce4c29178c'::uuid, 'b'::public.match_team, true, 5)
  ) as v(match_id, team, is_winner, points)
  where not exists (
    select 1 from public.match_players mp
    where mp.match_id = v.match_id and mp.roster_entry_id = v_roster_id
  );
end $$;

create or replace function public.get_player_match_history(p_player_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with resolved_profile as (
    select coalesce(
      case when exists (select 1 from public.profiles p where p.id = p_player_id) then p_player_id end,
      (select pp.profile_id from public.padel_players pp where pp.id = p_player_id limit 1)
    ) as id
  ),
  profile_ids as (
    select rp.id from resolved_profile rp where rp.id is not null
  ),
  padel_ids as (
    select p_player_id as id
    where exists (select 1 from public.padel_players pp where pp.id = p_player_id)
    union
    select pp.id from public.padel_players pp
    where pp.profile_id in (select id from profile_ids)
    union
    select distinct mp.padel_player_id
    from public.match_players mp
    where mp.profile_id in (select id from profile_ids)
      and mp.padel_player_id is not null
  ),
  player_matches as (
    select mp.match_id, mp.team, mp.is_winner, mp.points_earned
    from public.match_players mp
    where mp.profile_id in (select id from profile_ids)
       or mp.padel_player_id in (select id from padel_ids)
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
          left join public.profiles pr on pr.id = omp.profile_id
          left join public.padel_players ppl on ppl.id = omp.padel_player_id
          left join public.session_players sp on sp.id = omp.roster_entry_id
          where omp.match_id = m.id
            and omp.team = pm.team
            and not (
              omp.profile_id in (select id from profile_ids)
              or omp.padel_player_id in (select id from padel_ids)
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
