-- Use explicit game_minutes from scoring_config when set on the create form.

create or replace function public.start_competition(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_break_min int;
  v_game_min int;
  v_slot_min int;
  v_total_rounds int;
  v_round_id uuid;
  v_i int;
  v_is_americano boolean;
  v_duration_min numeric;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'open' then
    raise exception 'Competition must be open';
  end if;
  if v_session.starts_at is null or v_session.ends_at is null then
    raise exception 'Start and end time required';
  end if;

  if (select count(*) from public.session_players where session_id = p_session_id) < 4 then
    raise exception 'Need at least 4 players';
  end if;

  v_is_americano := v_session.partnership_mode = 'americano'
    or coalesce(v_session.rules, '') ilike '%americano%';

  v_break_min := greatest(0, coalesce((v_session.scoring_config->>'break_minutes')::int, 3));
  v_total_rounds := greatest(1, coalesce((v_session.scoring_config->>'americano_games')::int, 7));
  v_duration_min := extract(epoch from (v_session.ends_at - v_session.starts_at)) / 60.0;

  if not v_is_americano then
    v_game_min := 15;
    v_slot_min := v_game_min + v_break_min;
    v_total_rounds := greatest(1, ((v_duration_min + v_break_min) / v_slot_min)::int);
  else
    v_game_min := coalesce((v_session.scoring_config->>'game_minutes')::int, 0);
    if v_game_min < 1 then
      v_game_min := greatest(1, floor(v_duration_min / v_total_rounds - v_break_min)::int);
    end if;
    v_slot_min := v_game_min + v_break_min;
    if v_total_rounds * v_game_min + greatest(0, v_total_rounds - 1) * v_break_min > v_duration_min then
      raise exception 'Schedule exceeds session time';
    end if;
  end if;

  delete from public.competition_rounds where session_id = p_session_id;

  for v_i in 1..v_total_rounds loop
    insert into public.competition_rounds (
      session_id, round_number, is_final, starts_at, ends_at, status
    ) values (
      p_session_id,
      v_i,
      v_i = v_total_rounds,
      v_session.starts_at + ((v_i - 1) * v_slot_min) * interval '1 minute',
      v_session.starts_at + (((v_i - 1) * v_slot_min) + v_game_min) * interval '1 minute',
      case when v_i = 1 then 'active' else 'pending' end
    )
    returning id into v_round_id;

    perform public.assign_competition_round(v_round_id, p_session_id);
  end loop;

  update public.game_sessions
  set status = 'locked', competition_started_at = now()
  where id = p_session_id;
end;
$body$;
