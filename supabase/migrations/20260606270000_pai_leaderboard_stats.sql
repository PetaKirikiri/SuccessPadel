-- Seed Pai (player15) with 100W · 0L · 100 season points.

do $body$
declare
  v_profile_id uuid;
  v_season_id uuid;
  v_session_id uuid;
  v_match_id uuid;
  v_i int;
begin
  select p.id into v_profile_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'player15@fake.successpadel.test'
  limit 1;

  if v_profile_id is null then
    raise exception 'Pai profile not found';
  end if;

  select id into v_season_id from public.seasons where is_active limit 1;
  if v_season_id is null then
    raise exception 'No active season';
  end if;

  delete from public.match_players mp
  using public.matches m, public.game_sessions gs
  where mp.match_id = m.id
    and m.session_id = gs.id
    and gs.season_id = v_season_id
    and mp.profile_id = v_profile_id;

  delete from public.matches m
  using public.game_sessions gs
  where m.session_id = gs.id
    and gs.season_id = v_season_id
    and gs.title = 'Pai stats seed';

  insert into public.game_sessions (
    season_id, title, starts_on, ends_on, status, game_kind, scoring_preset
  ) values (
    v_season_id, 'Pai stats seed', current_date, current_date, 'locked', 'competition', 'participation'
  )
  returning id into v_session_id;

  for v_i in 1..100 loop
    insert into public.matches (session_id, score_summary, created_by)
    values (v_session_id, '6-0', v_profile_id)
    returning id into v_match_id;

    insert into public.match_players (match_id, profile_id, team, is_winner, points_earned)
    values (v_match_id, v_profile_id, 'a', true, 1);
  end loop;
end;
$body$;
