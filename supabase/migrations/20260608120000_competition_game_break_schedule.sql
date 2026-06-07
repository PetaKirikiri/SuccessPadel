-- Schedule competition rounds as game time + 1 min break between games (not back-to-back 15 min blocks).

create or replace function public.start_competition(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_game_min int := 15;
  v_break_min int := 1;
  v_slot_min int;
  v_duration_min int;
  v_total_rounds int;
  v_round_id uuid;
  v_i int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

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
  if v_session.ends_at <= v_session.starts_at then
    raise exception 'Invalid time range';
  end if;

  if (select count(*) from public.session_players where session_id = p_session_id) < 4 then
    raise exception 'Need at least 4 players';
  end if;

  v_slot_min := v_game_min + v_break_min;
  v_duration_min := (extract(epoch from (v_session.ends_at - v_session.starts_at)) / 60)::int;

  if v_duration_min < v_game_min then
    raise exception 'Event too short for one game';
  end if;

  v_total_rounds := greatest(1, (v_duration_min + v_break_min) / v_slot_min);

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

    if v_i = 1 then
      perform public.assign_competition_round(v_round_id, p_session_id);
    end if;
  end loop;

  update public.game_sessions
  set status = 'locked', competition_started_at = now()
  where id = p_session_id;
end;
$body$;
