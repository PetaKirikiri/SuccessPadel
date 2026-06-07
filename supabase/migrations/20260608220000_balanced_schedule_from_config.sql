-- Apply precomputed balanced schedule from game_sessions.scoring_config.schedule.

create or replace function public.assign_ranked_americano_round(p_round_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_round_number int;
  v_schedule jsonb;
  v_round jsonb;
  v_match jsonb;
  v_courts uuid[];
  v_court_id uuid;
  v_court_idx int;
  v_team_a uuid[];
  v_team_b uuid[];
  v_player uuid;
begin
  delete from public.competition_round_players where round_id = p_round_id;

  select round_number into v_round_number
  from public.competition_rounds where id = p_round_id;

  select scoring_config->'schedule' into v_schedule
  from public.game_sessions where id = p_session_id;

  if v_schedule is not null and jsonb_typeof(v_schedule) = 'array' then
    select elem into v_round
    from jsonb_array_elements(v_schedule) elem
    where (elem->>'round')::int = v_round_number
    limit 1;

    if v_round is not null and jsonb_typeof(v_round->'matches') = 'array' then
      select coalesce(array_agg(c.id order by c.sort_order), '{}')
      into v_courts
      from public.courts c
      where c.is_active;

      for v_match in select * from jsonb_array_elements(v_round->'matches') loop
        v_court_idx := coalesce((v_match->>'court')::int, 1);
        v_court_id := v_courts[v_court_idx];

        select coalesce(array_agg(value::uuid), '{}')
        into v_team_a
        from jsonb_array_elements_text(v_match->'team_a');

        select coalesce(array_agg(value::uuid), '{}')
        into v_team_b
        from jsonb_array_elements_text(v_match->'team_b');

        foreach v_player in array v_team_a loop
          insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
          select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
          from public.session_players sp where sp.id = v_player;
        end loop;

        foreach v_player in array v_team_b loop
          insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
          select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
          from public.session_players sp where sp.id = v_player;
        end loop;
      end loop;

      return;
    end if;
  end if;

  raise exception 'No balanced schedule saved — tap Propose new matchups then Start competition';
end;
$body$;

notify pgrst, 'reload schema';
