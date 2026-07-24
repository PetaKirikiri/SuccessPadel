-- One persisted timing authority for competition setup, rounds, and game cards.
alter table public.game_sessions
  add column if not exists schedule_game_count smallint,
  add column if not exists schedule_game_minutes smallint,
  add column if not exists schedule_break_minutes smallint;

update public.game_sessions
set
  schedule_game_count = case
    when coalesce(scoring_config->>'americano_games', '') ~ '^[0-9]+$'
      and (scoring_config->>'americano_games')::int between 1 and 20
      then (scoring_config->>'americano_games')::int
    else 6
  end,
  schedule_game_minutes = case
    when coalesce(scoring_config->>'game_minutes', '') ~ '^[0-9]+$'
      and (scoring_config->>'game_minutes')::int between 5 and 60
      then (scoring_config->>'game_minutes')::int
    else 15
  end,
  schedule_break_minutes = case
    when coalesce(scoring_config->>'break_minutes', '') ~ '^[0-9]+$'
      and (scoring_config->>'break_minutes')::int between 0 and 30
      then (scoring_config->>'break_minutes')::int
    else 4
  end,
  scoring_config = coalesce(scoring_config, '{}'::jsonb)
    - 'americano_games' - 'game_minutes' - 'break_minutes'
where game_kind = 'competition';

alter table public.game_sessions
  add constraint game_sessions_schedule_ranges_check check (
    (schedule_game_count is null or schedule_game_count between 1 and 20)
    and (schedule_game_minutes is null or schedule_game_minutes between 5 and 60)
    and (schedule_break_minutes is null or schedule_break_minutes between 0 and 30)
  ),
  add constraint game_sessions_competition_schedule_required_check check (
    game_kind <> 'competition'
    or (
      schedule_game_count is not null
      and schedule_game_minutes is not null
      and schedule_break_minutes is not null
    )
  );

comment on column public.game_sessions.schedule_game_count is
  'Authoritative number of scheduled rounds. Competition timing must not be stored in scoring_config.';
comment on column public.game_sessions.schedule_game_minutes is
  'Authoritative planned duration of each round in minutes.';
comment on column public.game_sessions.schedule_break_minutes is
  'Authoritative planned break between rounds in minutes.';

create or replace function public.save_competition_scoring_config(
  p_session_id uuid,
  p_scoring_config jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_clean_config jsonb;
begin
  v_clean_config := coalesce(p_scoring_config, '{}'::jsonb)
    - 'americano_games' - 'game_minutes' - 'break_minutes';

  if public.is_admin() then
    update public.game_sessions
    set scoring_config = v_clean_config
    where id = p_session_id
      and game_kind = 'competition'
      and status <> 'complete';

    if not found then raise exception 'Cannot update competition config'; end if;
    return;
  end if;

  update public.game_sessions
  set scoring_config = v_clean_config
  where id = p_session_id
    and game_kind = 'competition'
    and status = 'open'
    and competition_started_at is null;

  if not found then raise exception 'Cannot update competition config'; end if;
end;
$body$;

create or replace function public.start_competition(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_slot_min int;
  v_round_id uuid;
  v_i int;
  v_duration_min numeric;
  v_min_players int;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then raise exception 'Not a competition'; end if;
  if v_session.status <> 'open' then raise exception 'Competition must be open'; end if;
  if v_session.starts_at is null or v_session.ends_at is null then
    raise exception 'Start and end time required';
  end if;

  v_min_players := case
    when coalesce(v_session.scoring_config->>'competition_player_mode', 'singles') = 'duos'
      then 12 else 4
  end;
  if (select count(*) from public.session_players where session_id = p_session_id) < v_min_players then
    raise exception 'Need at least % players', v_min_players;
  end if;

  if v_session.schedule_game_count is null
    or v_session.schedule_game_minutes is null
    or v_session.schedule_break_minutes is null then
    raise exception 'Competition schedule is missing. Save competition setup again.';
  end if;

  v_duration_min := extract(epoch from (v_session.ends_at - v_session.starts_at)) / 60.0;
  if v_session.schedule_game_count * v_session.schedule_game_minutes
      + greatest(0, v_session.schedule_game_count - 1) * v_session.schedule_break_minutes
      > v_duration_min then
    raise exception 'Schedule exceeds session time';
  end if;

  v_slot_min := v_session.schedule_game_minutes + v_session.schedule_break_minutes;
  delete from public.competition_rounds where session_id = p_session_id;

  for v_i in 1..v_session.schedule_game_count loop
    insert into public.competition_rounds (
      session_id, round_number, is_final, starts_at, ends_at, status
    ) values (
      p_session_id,
      v_i,
      v_i = v_session.schedule_game_count,
      v_session.starts_at + ((v_i - 1) * v_slot_min) * interval '1 minute',
      v_session.starts_at
        + (((v_i - 1) * v_slot_min) + v_session.schedule_game_minutes) * interval '1 minute',
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

grant execute on function public.start_competition(uuid) to anon, authenticated;

drop function if exists public.create_duo_league(uuid, text, text, text, jsonb, jsonb, jsonb, uuid);
drop function if exists public.create_duo_league(uuid, text, text, text, jsonb, jsonb, jsonb, uuid, int);

create function public.create_duo_league(
  p_season_id uuid,
  p_title text,
  p_skill_level text,
  p_gender text,
  p_slots jsonb,
  p_pairs jsonb,
  p_scoring_config jsonb,
  p_created_by uuid default null,
  p_target_players int default 12,
  p_schedule_game_count int default 6,
  p_schedule_game_minutes int default 15,
  p_schedule_break_minutes int default 4
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_group_id uuid;
  v_session_id uuid;
  v_week int;
  v_session_ids uuid[] := '{}';
  v_cfg jsonb;
  v_target int;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if p_schedule_game_count not between 1 and 20
    or p_schedule_game_minutes not between 5 and 60
    or p_schedule_break_minutes not between 0 and 30 then
    raise exception 'Competition schedule is invalid';
  end if;

  v_target := greatest(4, least(16, coalesce(p_target_players, 12)));
  insert into public.game_groups (created_by, rotation_enabled)
  values (p_created_by, false)
  returning id into v_group_id;

  for v_week in 1..6 loop
    v_cfg := (
      coalesce(p_scoring_config, '{}'::jsonb)
        - 'americano_games' - 'game_minutes' - 'break_minutes'
    ) || jsonb_build_object(
      'competition_player_mode', 'duos',
      'league_id', v_group_id::text,
      'league_week', v_week
    );

    insert into public.game_sessions (
      season_id, title, starts_on, ends_on, status, partnership_mode,
      scoring_preset, scoring_config, who_can_log_matches, margin_bonus_enabled,
      max_players, target_players, player_cap_mode, game_kind, visibility,
      created_by, game_group_id, week_number, skill_level, gender, rules,
      schedule_game_count, schedule_game_minutes, schedule_break_minutes
    ) values (
      p_season_id, p_title || ' · Week ' || v_week, current_date, current_date,
      'draft', 'fixed_pairs', 'standard', v_cfg, 'roster_members', true,
      v_target, v_target, 'strict', 'competition', 'open', p_created_by,
      v_group_id, v_week, p_skill_level, p_gender,
      'Duos · ' || p_schedule_game_count || ' rounds · fixed pairs',
      p_schedule_game_count, p_schedule_game_minutes, p_schedule_break_minutes
    )
    returning id into v_session_id;

    v_session_ids := array_append(v_session_ids, v_session_id);
    perform public.sync_competition_roster_slots(v_session_id, p_slots);
    perform public.sync_competition_pairs(v_session_id, p_pairs);

    if coalesce(v_cfg->'schedule', 'null'::jsonb) is not null
      and jsonb_typeof(v_cfg->'schedule') = 'array' then
      perform public.save_competition_scoring_config(v_session_id, v_cfg);
    end if;
  end loop;

  return jsonb_build_object(
    'league_id', v_group_id,
    'session_ids', to_jsonb(v_session_ids)
  );
end;
$body$;

grant execute on function public.create_duo_league(
  uuid, text, text, text, jsonb, jsonb, jsonb, uuid, int, int, int, int
) to authenticated;
