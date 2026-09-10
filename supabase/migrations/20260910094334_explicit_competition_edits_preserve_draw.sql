-- Deliberate admin edits may change timing and occupant identity, never geometry.
create or replace function public.prevent_started_competition_round_structure_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and public.is_admin()
     and (to_jsonb(new) - 'starts_at' - 'ends_at') = (to_jsonb(old) - 'starts_at' - 'ends_at') then
    return new;
  end if;
  if exists (select 1 from public.game_sessions where id =
    case when tg_op = 'INSERT' then new.session_id else old.session_id end
    and competition_started_at is not null and game_kind = 'competition') then
    raise exception 'Existing rounds cannot be regenerated or rearranged';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function public.prevent_started_competition_court_assignment_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and public.is_admin()
     and (to_jsonb(new) - 'profile_id') = (to_jsonb(old) - 'profile_id') then
    return new;
  end if;
  if exists (select 1 from public.competition_rounds r join public.game_sessions s on s.id = r.session_id
    where r.id = case when tg_op = 'INSERT' then new.round_id else old.round_id end
      and s.competition_started_at is not null and s.game_kind = 'competition') then
    raise exception 'Existing court positions cannot be rearranged';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function public.edit_competition_preserving_draw(
  p_session_id uuid, p_slots jsonb, p_starts_at timestamptz,
  p_ends_at timestamptz, p_games integer, p_game_minutes integer,
  p_break_minutes integer, p_title text
) returns void language plpgsql security invoker set search_path = public as $$
declare
  s public.game_sessions%rowtype;
  r public.session_players%rowtype;
  slot jsonb;
  player_id uuid;
  member_id uuid;
  actual_games integer;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Admin only';
  end if;
  select * into s from public.game_sessions where id = p_session_id for update;
  if not found or s.game_kind <> 'competition' or s.status = 'complete' then
    raise exception 'Competition is unavailable or complete';
  end if;
  select count(*) into actual_games from public.competition_rounds where session_id = p_session_id;
  if actual_games = 0 or p_games is distinct from actual_games then
    raise exception 'Keep the existing game count; this edit does not rebuild games';
  end if;
  if p_game_minutes is null or p_game_minutes not between 5 and 60
     or p_break_minutes is null or p_break_minutes not between 0 and 30
     or p_starts_at is null or p_ends_at is null
     or p_starts_at + make_interval(mins => p_games * p_game_minutes + (p_games - 1) * p_break_minutes) > p_ends_at then
    raise exception 'The complete schedule must fit within the selected times';
  end if;
  if jsonb_typeof(p_slots) is distinct from 'array' or jsonb_array_length(p_slots) <>
    (select count(*) from public.session_players where session_id = p_session_id) then
    raise exception 'Keep the existing roster slots';
  end if;
  for r in select * from public.session_players where session_id = p_session_id order by rank_order for update loop
    slot := p_slots->r.rank_order;
    if slot is null or nullif(trim(slot->>'name'), '') is null then
      raise exception 'Every existing slot needs a player';
    end if;
    member_id := nullif(slot->>'profile_id', '')::uuid;
    player_id := nullif(slot->>'padel_player_id', '')::uuid;
    if player_id is null then
      player_id := public.find_or_create_padel_player(slot->>'name', null, member_id);
    end if;
    if member_id is not null and not exists (select 1 from public.padel_players where id = player_id and profile_id = member_id) then
      raise exception 'Player account does not match the selected member';
    end if;
    -- Preserve roster ID, rank, pairs, round IDs, courts, teams and saved scores.
    update public.session_players set profile_id = member_id, padel_player_id = player_id,
      guest_name = case when member_id is null then trim(slot->>'name') else null end
      where id = r.id;
    update public.competition_round_players set profile_id = member_id
      where roster_entry_id = r.id and profile_id is distinct from member_id;
  end loop;
  if exists (select 1 from public.session_players where session_id = p_session_id
    group by padel_player_id having count(*) > 1) then
    raise exception 'A player cannot occupy two roster slots';
  end if;
  update public.competition_rounds set
    starts_at = p_starts_at + make_interval(mins => (round_number - 1) * (p_game_minutes + p_break_minutes)),
    ends_at = p_starts_at + make_interval(mins => (round_number - 1) * (p_game_minutes + p_break_minutes) + p_game_minutes)
    where session_id = p_session_id;
  update public.game_sessions set title = p_title, starts_at = p_starts_at, ends_at = p_ends_at,
    starts_on = (p_starts_at at time zone 'Asia/Bangkok')::date,
    ends_on = (p_ends_at at time zone 'Asia/Bangkok')::date,
    schedule_game_count = p_games, schedule_game_minutes = p_game_minutes, schedule_break_minutes = p_break_minutes,
    scoring_config = coalesce(scoring_config, '{}'::jsonb) || jsonb_build_object(
      'americano_games', p_games, 'game_minutes', p_game_minutes, 'break_minutes', p_break_minutes)
    where id = p_session_id;
end $$;
revoke all on function public.edit_competition_preserving_draw(uuid,jsonb,timestamptz,timestamptz,integer,integer,integer,text) from public, anon;
grant execute on function public.edit_competition_preserving_draw(uuid,jsonb,timestamptz,timestamptz,integer,integer,integer,text) to authenticated;
