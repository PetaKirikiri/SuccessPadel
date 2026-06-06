-- Rotation assignments for multi-court games

create or replace function public.apply_group_rotation(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions%rowtype;
  v_other_session_id uuid;
  v_other_court_id uuid;
  v_slot record;
  v_other_slot_id uuid;
  v_players uuid[];
  v_player uuid;
  v_idx int := 0;
  v_on_a int;
  v_court_a uuid;
  v_court_b uuid;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_group_id is null then
    return;
  end if;

  select gs.id, gs.court_id into v_other_session_id, v_other_court_id
  from public.game_sessions gs
  where gs.game_group_id = v_session.game_group_id and gs.id <> p_session_id
  limit 1;

  if v_other_session_id is null then return; end if;

  for v_slot in
    select * from public.game_slots where session_id = p_session_id order by slot_index
  loop
    select gs.id into v_other_slot_id
    from public.game_slots gs
    where gs.session_id = v_other_session_id and gs.slot_index = v_slot.slot_index;

    select array_agg(sp.profile_id order by sp.joined_at)
    into v_players
    from public.slot_players sp
    where sp.slot_id = v_slot.id;

    delete from public.slot_court_assignments where slot_id in (v_slot.id, v_other_slot_id);

    if v_players is null then continue; end if;

    if v_slot.slot_index % 2 = 0 then
      v_court_a := v_session.court_id;
      v_court_b := v_other_court_id;
    else
      v_court_a := v_other_court_id;
      v_court_b := v_session.court_id;
    end if;

    v_on_a := 0;
    v_idx := 0;
    foreach v_player in array v_players loop
      v_idx := v_idx + 1;
      if v_on_a < 4 then
        insert into public.slot_court_assignments (slot_id, court_id, profile_id)
        values (v_slot.id, v_court_a, v_player)
        on conflict do nothing;
        v_on_a := v_on_a + 1;
      else
        insert into public.slot_court_assignments (slot_id, court_id, profile_id)
        values (v_other_slot_id, v_court_b, v_player)
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.expand_game_to_two_courts(
  p_session_id uuid,
  p_second_court_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions%rowtype;
  v_group_id uuid;
  v_new_session_id uuid;
  v_slot record;
  v_new_slot_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  if v_session.game_kind <> 'court' then raise exception 'Not a court game'; end if;

  if v_session.game_group_id is not null then
    raise exception 'Already part of a group';
  end if;

  if exists (
    select 1 from public.game_sessions gs
    where gs.game_kind = 'court'
      and gs.court_id = p_second_court_id
      and gs.status not in ('draft', 'cancelled')
      and gs.starts_at is not null
      and gs.ends_at is not null
      and tstzrange(gs.starts_at, gs.ends_at, '[)') && tstzrange(v_session.starts_at, v_session.ends_at, '[)')
  ) then
    raise exception 'Second court not available for this time range';
  end if;

  insert into public.game_groups (created_by, rotation_enabled, rotation_mode)
  values (auth.uid(), true, 'between_courts')
  returning id into v_group_id;

  update public.game_sessions set game_group_id = v_group_id where id = p_session_id;

  insert into public.game_sessions (
    season_id, title, starts_on, ends_on, status, game_kind,
    court_id, starts_at, ends_at, visibility, target_players,
    player_cap_mode, max_players, created_by, game_group_id,
    partnership_mode, scoring_preset, who_can_log_matches
  )
  select
    v_session.season_id,
    replace(v_session.title, (select c.name from public.courts c where c.id = v_session.court_id), (select c2.name from public.courts c2 where c2.id = p_second_court_id)),
    v_session.starts_on,
    v_session.ends_on,
    v_session.status,
    'court',
    p_second_court_id,
    v_session.starts_at,
    v_session.ends_at,
    v_session.visibility,
    v_session.target_players,
    v_session.player_cap_mode,
    v_session.max_players,
    auth.uid(),
    v_group_id,
    v_session.partnership_mode,
    v_session.scoring_preset,
    v_session.who_can_log_matches
  returning id into v_new_session_id;

  for v_slot in select * from public.game_slots where session_id = p_session_id order by slot_index
  loop
    insert into public.game_slots (session_id, starts_at, ends_at, slot_index)
    values (v_new_session_id, v_slot.starts_at, v_slot.ends_at, v_slot.slot_index)
    returning id into v_new_slot_id;
  end loop;

  perform public.apply_group_rotation(p_session_id);

  return v_group_id;
end;
$$;

grant execute on function public.apply_group_rotation(uuid) to authenticated;

create or replace function public.session_roster_count(p_session_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select game_group_id from public.game_sessions where id = p_session_id
  )
  select count(distinct sp.profile_id)::int
  from public.game_slots gs
  join public.slot_players sp on sp.slot_id = gs.id
  join public.game_sessions s on s.id = gs.session_id
  where gs.session_id = p_session_id
     or (
       (select game_group_id from ctx) is not null
       and s.game_group_id = (select game_group_id from ctx)
     );
$$;

create or replace function public.join_game_slot(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_on_court int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select gs.session_id into v_session_id
  from public.game_slots gs where gs.id = p_slot_id;
  if not found then raise exception 'Slot not found'; end if;

  if not public.can_join_session(v_session_id) then
    raise exception 'Game is full';
  end if;

  select count(*) into v_on_court
  from public.slot_players sp
  where sp.slot_id = p_slot_id;

  if v_on_court >= 4 then
    raise exception 'This hour block already has 4 players on court';
  end if;

  insert into public.slot_players (slot_id, profile_id)
  values (p_slot_id, auth.uid())
  on conflict do nothing;

  perform public.apply_group_rotation(v_session_id);
end;
$$;
