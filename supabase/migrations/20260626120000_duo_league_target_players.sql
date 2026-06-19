-- Allow duo leagues to use court-driven roster size (not always 12 players).

create or replace function public.create_duo_league(
  p_season_id uuid,
  p_title text,
  p_skill_level text,
  p_gender text,
  p_slots jsonb,
  p_pairs jsonb,
  p_scoring_config jsonb,
  p_created_by uuid default null,
  p_target_players int default 12
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
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  v_target := greatest(4, least(16, coalesce(p_target_players, 12)));

  insert into public.game_groups (created_by, rotation_enabled)
  values (p_created_by, false)
  returning id into v_group_id;

  for v_week in 1..6 loop
    v_cfg := coalesce(p_scoring_config, '{}'::jsonb)
      || jsonb_build_object(
        'competition_player_mode', 'duos',
        'league_id', v_group_id::text,
        'league_week', v_week
      );

    insert into public.game_sessions (
      season_id,
      title,
      starts_on,
      ends_on,
      status,
      partnership_mode,
      scoring_preset,
      scoring_config,
      who_can_log_matches,
      margin_bonus_enabled,
      max_players,
      target_players,
      player_cap_mode,
      game_kind,
      visibility,
      created_by,
      game_group_id,
      week_number,
      skill_level,
      gender,
      rules
    ) values (
      p_season_id,
      p_title || ' · Week ' || v_week,
      current_date,
      current_date,
      'draft',
      'fixed_pairs',
      'standard',
      v_cfg,
      'roster_members',
      true,
      v_target,
      v_target,
      'strict',
      'competition',
      'open',
      p_created_by,
      v_group_id,
      v_week,
      p_skill_level,
      p_gender,
      'Duos · 6 games · fixed pairs'
    )
    returning id into v_session_id;

    v_session_ids := array_append(v_session_ids, v_session_id);

    perform public.sync_competition_roster_slots(v_session_id, p_slots);
    perform public.sync_competition_pairs(v_session_id, p_pairs);

    if coalesce(p_scoring_config->'schedule', 'null'::jsonb) is not null
      and jsonb_typeof(p_scoring_config->'schedule') = 'array' then
      perform public.save_competition_scoring_config(v_session_id, v_cfg);
    end if;
  end loop;

  return jsonb_build_object(
    'league_id', v_group_id,
    'session_ids', to_jsonb(v_session_ids)
  );
end;
$body$;

grant execute on function public.create_duo_league(uuid, text, text, text, jsonb, jsonb, jsonb, uuid, int) to authenticated;
