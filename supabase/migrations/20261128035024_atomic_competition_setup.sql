-- Keep a retry of a league setup request attached to its originally saved group.
alter table public.game_groups add column competition_setup_request_id uuid unique;

create function public.save_competition_setup(
  p_request_id uuid,
  p_create boolean,
  p_league boolean,
  p_fields jsonb,
  p_slots jsonb,
  p_pairs jsonb,
  p_slot_schedule jsonb,
  p_schedule_seed integer,
  p_schedule_version integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_fields public.game_sessions%rowtype;
  v_session public.game_sessions%rowtype;
  v_session_ids uuid[];
  v_session_id uuid;
  v_group_id uuid;
  v_league jsonb;
  v_roster_ids jsonb;
  v_schedule jsonb;
  v_round jsonb;
  v_match jsonb;
  v_matches jsonb;
  v_team_key text;
  v_team jsonb;
  v_slot text;
  v_config jsonb;
begin
  if v_actor is null or not coalesce(public.is_admin(), false) then
    raise exception 'Admin only';
  end if;
  if p_request_id is null or p_create is null or p_league is null
    or (p_league and not p_create)
    or jsonb_typeof(p_fields) is distinct from 'object'
    or jsonb_typeof(p_slots) is distinct from 'array'
    or (p_pairs is not null and jsonb_typeof(p_pairs) <> 'array')
    or (p_slot_schedule is not null and jsonb_typeof(p_slot_schedule) <> 'array') then
    raise exception 'Invalid competition setup';
  end if;

  select * into v_fields from jsonb_populate_record(null::public.game_sessions, p_fields);
  if v_fields.season_id is null or nullif(btrim(v_fields.title), '') is null
    or v_fields.schedule_game_count is null or v_fields.schedule_game_count not between 1 and 20
    or v_fields.schedule_game_minutes is null or v_fields.schedule_game_minutes not between 5 and 60
    or v_fields.schedule_break_minutes is null or v_fields.schedule_break_minutes not between 0 and 30
    or v_fields.target_players is null or v_fields.target_players not in (4, 8, 12, 16)
    or jsonb_array_length(p_slots) > v_fields.target_players
    or (p_slot_schedule is not null and jsonb_array_length(p_slot_schedule) <> v_fields.schedule_game_count) then
    raise exception 'Invalid competition schedule or roster';
  end if;
  if not p_league and (
    v_fields.starts_at is null or v_fields.ends_at is null
    or v_fields.starts_at + make_interval(mins =>
      v_fields.schedule_game_count * v_fields.schedule_game_minutes
      + (v_fields.schedule_game_count - 1) * v_fields.schedule_break_minutes
    ) > v_fields.ends_at
  ) then
    raise exception 'The complete schedule must fit within the selected times';
  end if;

  if p_league then
    perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
    select id into v_group_id from public.game_groups
      where competition_setup_request_id = p_request_id and created_by = v_actor;
    if found then
      return v_group_id;
    end if;
    v_league := public.create_duo_league(
      v_fields.season_id, v_fields.title, v_fields.skill_level, v_fields.gender,
      p_slots, p_pairs, v_fields.scoring_config, v_actor, v_fields.target_players,
      v_fields.schedule_game_count, v_fields.schedule_game_minutes, v_fields.schedule_break_minutes
    );
    v_group_id := (v_league->>'league_id')::uuid;
    update public.game_groups set competition_setup_request_id = p_request_id where id = v_group_id;
    if not found then raise exception 'Could not save league setup'; end if;
    select array_agg(value::uuid) into v_session_ids from jsonb_array_elements_text(v_league->'session_ids');
  else
    if p_create then
      insert into public.game_sessions (
        id, season_id, title, starts_on, ends_on, starts_at, ends_at, game_kind, status, visibility,
        created_by, skill_level, gender, rules, target_players, max_players, player_cap_mode,
        partnership_mode, scoring_preset, scoring_config, who_can_log_matches, margin_bonus_enabled,
        schedule_game_count, schedule_game_minutes, schedule_break_minutes
      ) values (
        p_request_id, v_fields.season_id, v_fields.title,
        (v_fields.starts_at at time zone 'Asia/Bangkok')::date,
        (v_fields.ends_at at time zone 'Asia/Bangkok')::date,
        v_fields.starts_at, v_fields.ends_at, 'competition', 'open', 'open',
        v_actor, v_fields.skill_level, v_fields.gender, v_fields.rules,
        v_fields.target_players, v_fields.max_players, v_fields.player_cap_mode,
        v_fields.partnership_mode, v_fields.scoring_preset, v_fields.scoring_config,
        v_fields.who_can_log_matches, v_fields.margin_bonus_enabled,
        v_fields.schedule_game_count, v_fields.schedule_game_minutes, v_fields.schedule_break_minutes
      )
      on conflict (id) do nothing;
      if not found then
        if exists (select 1 from public.game_sessions where id = p_request_id
            and game_kind = 'competition' and created_by = v_actor) then
          return p_request_id;
        end if;
        raise exception 'Competition request already exists';
      end if;
    else
      select * into v_session from public.game_sessions where id = p_request_id for update;
      if not found or v_session.game_kind <> 'competition' or v_session.status = 'complete'
        or v_session.competition_started_at is not null
        or exists (select 1 from public.competition_rounds where session_id = p_request_id) then
        raise exception 'Competition unavailable for setup. Reload to edit an existing draw.';
      end if;
      update public.game_sessions set
        season_id = v_fields.season_id,
        title = v_fields.title,
        starts_on = (v_fields.starts_at at time zone 'Asia/Bangkok')::date,
        ends_on = (v_fields.ends_at at time zone 'Asia/Bangkok')::date,
        starts_at = v_fields.starts_at,
        ends_at = v_fields.ends_at,
        skill_level = v_fields.skill_level, gender = v_fields.gender, rules = v_fields.rules,
        target_players = v_fields.target_players, max_players = v_fields.max_players,
        player_cap_mode = v_fields.player_cap_mode, partnership_mode = v_fields.partnership_mode,
        scoring_preset = v_fields.scoring_preset, who_can_log_matches = v_fields.who_can_log_matches,
        margin_bonus_enabled = v_fields.margin_bonus_enabled,
        schedule_game_count = v_fields.schedule_game_count,
        schedule_game_minutes = v_fields.schedule_game_minutes,
        schedule_break_minutes = v_fields.schedule_break_minutes
      where id = p_request_id;
      if not found then raise exception 'Could not update competition setup'; end if;
    end if;
    perform public.sync_competition_roster_slots(p_request_id, p_slots, coalesce(p_pairs, '[]'::jsonb));
    v_session_ids := array[p_request_id];
  end if;

  foreach v_session_id in array v_session_ids loop
    -- Translate draft slot references after the roster RPC assigns database IDs.
    select jsonb_object_agg(rank::text, coalesce(to_jsonb(sp.id),
      to_jsonb('00000000-0000-4000-8000-' || lpad(rank::text, 12, '0'))))
    into v_roster_ids
    from generate_series(0, v_fields.target_players - 1) as rank
    left join public.session_players sp on sp.session_id = v_session_id and sp.rank_order = rank;

    select (scoring_config - 'schedule' - 'schedule_seed' - 'schedule_version' - 'teams')
      || v_fields.scoring_config
    into v_config from public.game_sessions where id = v_session_id;

    if p_slot_schedule is not null then
      v_schedule := '[]'::jsonb;
      for v_round in select value from jsonb_array_elements(p_slot_schedule) loop
        v_matches := '[]'::jsonb;
        for v_match in select value from jsonb_array_elements(v_round->'matches') loop
          foreach v_team_key in array array['team_a', 'team_b'] loop
            v_team := '[]'::jsonb;
            for v_slot in select value from jsonb_array_elements_text(v_match->v_team_key) loop
              if v_slot is null or not (v_roster_ids ? v_slot) then
                raise exception 'Unknown player slot in competition schedule';
              end if;
              v_team := v_team || jsonb_build_array(v_roster_ids->v_slot);
            end loop;
            if jsonb_array_length(v_team) <> 2 then
              raise exception 'Invalid team size in competition schedule';
            end if;
            v_match := jsonb_set(v_match, array[v_team_key], v_team);
          end loop;
          v_matches := v_matches || jsonb_build_array(v_match);
        end loop;
        v_schedule := v_schedule || jsonb_build_array(jsonb_set(v_round, '{matches}', v_matches));
      end loop;
      v_config := v_config || jsonb_build_object(
        'schedule', v_schedule, 'schedule_seed', p_schedule_seed, 'schedule_version', p_schedule_version
      );
      if p_pairs is not null then
        select v_config || jsonb_build_object('teams', coalesce(jsonb_agg(jsonb_build_object(
          'label', p.pair_label, 'roster_ids', jsonb_build_array(p.roster_a_id, p.roster_b_id)
        ) order by sp.rank_order), '[]'::jsonb))
        into v_config
        from public.session_pairs p
        join public.session_players sp on sp.id = p.roster_a_id
        where p.session_id = v_session_id and p.roster_b_id is not null;
      end if;
    end if;
    perform public.save_competition_scoring_config(v_session_id, v_config);
  end loop;

  return coalesce(v_group_id, p_request_id);
end;
$$;

revoke all on function public.save_competition_setup(uuid, boolean, boolean, jsonb, jsonb, jsonb, jsonb, integer, integer)
  from public, anon, authenticated;
grant execute on function public.save_competition_setup(uuid, boolean, boolean, jsonb, jsonb, jsonb, jsonb, integer, integer)
  to authenticated;

-- Start and setup take the same session lock before reading the schedule.
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
  select * into v_session from public.game_sessions where id = p_session_id for update;
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

notify pgrst, 'reload schema';
