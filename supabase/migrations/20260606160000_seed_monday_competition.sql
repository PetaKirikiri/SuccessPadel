-- Monday night low-inter competition: 8 players, 6–8pm, 5 spots filled (3 open).
do $$
declare
  v_season_id uuid;
  v_session_id uuid;
  v_slot0 uuid;
  v_slot1 uuid;
  v_court_id uuid := '5a2ad18d-f129-4e1e-be2d-c7eb7b376f2a';
  v_starts timestamptz := '2026-06-08T18:00:00+07:00';
  v_ends timestamptz := '2026-06-08T20:00:00+07:00';
begin
  if exists (
    select 1 from public.game_sessions
    where title = 'Monday Night · Low Inter · 18:00–20:00'
  ) then
    return;
  end if;

  insert into public.seasons (name, starts_on, is_active)
  values ('Monday Night · Low Inter', '2026-06-08', false)
  returning id into v_season_id;

  insert into public.game_sessions (
    season_id, title, starts_on, ends_on, status, game_kind,
    court_id, starts_at, ends_at, visibility, target_players,
    player_cap_mode, max_players,
    partnership_mode, scoring_preset, who_can_log_matches
  ) values (
    v_season_id,
    'Monday Night · Low Inter · 18:00–20:00',
    '2026-06-08',
    '2026-06-08',
    'open',
    'court',
    v_court_id,
    v_starts,
    v_ends,
    'open',
    8,
    'strict',
    8,
    'rotating',
    'standard',
    'roster_members'
  )
  returning id into v_session_id;

  insert into public.game_slots (session_id, starts_at, ends_at, slot_index)
  values (v_session_id, v_starts, v_starts + interval '1 hour', 0)
  returning id into v_slot0;

  insert into public.game_slots (session_id, starts_at, ends_at, slot_index)
  values (v_session_id, v_starts + interval '1 hour', v_ends, 1)
  returning id into v_slot1;

  -- 5 players signed up (3 roster spots left)
  insert into public.slot_players (slot_id, profile_id) values
    (v_slot0, '65f33c61-b327-4db5-a32c-a80bee1184a2'), -- Alex
    (v_slot0, '69666c11-7080-44ba-bb24-d7271e542df2'), -- Maria
    (v_slot0, '0a69a58a-3107-48f6-b220-99940da5c868'), -- James
    (v_slot1, 'c4ec27f7-ad11-4877-87c8-4531ddc720bf'), -- Sofia
    (v_slot1, 'ed991a75-c3a8-4acd-a817-3e887dbd8032'), -- Emma
    (v_slot1, '65f33c61-b327-4db5-a32c-a80bee1184a2'),
    (v_slot1, '69666c11-7080-44ba-bb24-d7271e542df2')
  on conflict do nothing;
end $$;
