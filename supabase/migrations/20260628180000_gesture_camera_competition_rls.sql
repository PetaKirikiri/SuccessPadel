-- Camera gesture scoring: competition roster can write logs; spectators can read.

create policy match_gesture_logs_select_competition on public.match_gesture_logs
  for select
  to authenticated
  using (
    competition_id is not null
    and exists (
      select 1
      from public.game_sessions gs
      where gs.id::text = competition_id
        and gs.game_kind = 'competition'
        and gs.status in ('open', 'locked', 'complete')
    )
  );

create or replace function public.upsert_match_gesture_log(
  p_court_setup_key text,
  p_match_started_at timestamptz,
  p_friendly_session_id uuid default null,
  p_competition_id text default null,
  p_game_number text default null,
  p_court_id text default null,
  p_match_ended_at timestamptz default null,
  p_final_score jsonb default null,
  p_winner text default null,
  p_player_stats jsonb default '[]'::jsonb,
  p_point_events jsonb default '[]'::jsonb,
  p_gestures jsonb default '[]'::jsonb,
  p_roster jsonb default '[]'::jsonb,
  p_setup_state jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_admin boolean;
  v_session public.friendly_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_winner is not null and p_winner not in ('a', 'b') then
    raise exception 'Invalid winner';
  end if;

  select coalesce(is_admin, false) into v_admin
  from public.profiles
  where id = auth.uid();

  if p_friendly_session_id is not null then
    select * into v_session
    from public.friendly_sessions
    where id = p_friendly_session_id;

    if not found then
      raise exception 'Friendly session not found';
    end if;
  end if;

  if not v_admin then
    if p_friendly_session_id is not null then
      if v_session.created_by <> auth.uid()
         and not exists (
           select 1
           from jsonb_array_elements_text(coalesce(v_session.profile_ids, '[]'::jsonb)) pid
           where pid = auth.uid()::text
         ) then
        raise exception 'Not on roster';
      end if;
    elsif p_competition_id is not null then
      if not exists (
        select 1
        from public.game_sessions gs
        join public.competition_rounds cr on cr.session_id = gs.id
        join public.competition_round_players crp on crp.round_id = cr.id
        left join public.session_players sp on sp.id = crp.roster_entry_id
        where gs.id::text = p_competition_id
          and gs.game_kind = 'competition'
          and cr.round_number = (p_game_number)::int
          and crp.court_id::text = p_court_id
          and coalesce(crp.profile_id, sp.profile_id) = auth.uid()
      ) then
        raise exception 'Not on court roster';
      end if;
    else
      raise exception 'Admin only';
    end if;
  end if;

  insert into public.match_gesture_logs (
    court_setup_key,
    friendly_session_id,
    competition_id,
    game_number,
    court_id,
    match_started_at,
    match_ended_at,
    final_score,
    winner,
    player_stats,
    point_events,
    gestures,
    roster,
    setup_state,
    created_by,
    updated_at
  )
  values (
    p_court_setup_key,
    p_friendly_session_id,
    p_competition_id,
    p_game_number,
    p_court_id,
    p_match_started_at,
    p_match_ended_at,
    p_final_score,
    p_winner,
    coalesce(p_player_stats, '[]'::jsonb),
    coalesce(p_point_events, '[]'::jsonb),
    coalesce(p_gestures, '[]'::jsonb),
    coalesce(p_roster, '[]'::jsonb),
    coalesce(p_setup_state, '{}'::jsonb),
    auth.uid(),
    now()
  )
  on conflict (court_setup_key) do update
  set
    friendly_session_id = excluded.friendly_session_id,
    competition_id = excluded.competition_id,
    game_number = excluded.game_number,
    court_id = excluded.court_id,
    match_started_at = excluded.match_started_at,
    match_ended_at = excluded.match_ended_at,
    final_score = excluded.final_score,
    winner = excluded.winner,
    player_stats = excluded.player_stats,
    point_events = excluded.point_events,
    gestures = excluded.gestures,
    roster = excluded.roster,
    setup_state = excluded.setup_state,
    updated_at = now();

  return p_court_setup_key;
end;
$body$;

grant execute on function public.upsert_match_gesture_log(
  text, timestamptz, uuid, text, text, text, timestamptz, jsonb, text, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;

notify pgrst, 'reload schema';
