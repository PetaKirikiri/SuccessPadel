-- Duo competition: session_pairs roster refs, pair sync, duos schedule routing, league shell.

alter table public.session_pairs
  alter column player_a_id drop not null,
  alter column player_b_id drop not null;

alter table public.session_pairs
  add column if not exists roster_a_id uuid references public.session_players (id) on delete cascade,
  add column if not exists roster_b_id uuid references public.session_players (id) on delete cascade;

create index if not exists session_pairs_roster_a_idx on public.session_pairs (roster_a_id);
create index if not exists session_pairs_roster_b_idx on public.session_pairs (roster_b_id);

create or replace function public.sync_competition_pairs(
  p_session_id uuid,
  p_pairs jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_pair jsonb;
  v_label text;
  v_roster_a uuid;
  v_roster_b uuid;
  v_profile_a uuid;
  v_profile_b uuid;
  v_i int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;

  delete from public.session_pairs where session_id = p_session_id;

  if p_pairs is null or jsonb_typeof(p_pairs) <> 'array' then
    return;
  end if;

  for v_i in 0..jsonb_array_length(p_pairs) - 1 loop
    v_pair := p_pairs->v_i;
    v_label := nullif(btrim(coalesce(v_pair->>'label', '')), '');
    v_roster_a := nullif(v_pair->>'roster_a_id', '')::uuid;
    v_roster_b := nullif(v_pair->>'roster_b_id', '')::uuid;

    if v_roster_a is null and v_pair ? 'slot_a' then
      select sp.id into v_roster_a
      from public.session_players sp
      where sp.session_id = p_session_id
        and sp.rank_order = (v_pair->>'slot_a')::int;
    end if;

    if v_roster_b is null and v_pair ? 'slot_b' then
      select sp.id into v_roster_b
      from public.session_players sp
      where sp.session_id = p_session_id
        and sp.rank_order = (v_pair->>'slot_b')::int;
    end if;

    if v_roster_a is null or v_roster_b is null then
      continue;
    end if;

    select sp.profile_id into v_profile_a
    from public.session_players sp
    where sp.id = v_roster_a and sp.session_id = p_session_id;

    select sp.profile_id into v_profile_b
    from public.session_players sp
    where sp.id = v_roster_b and sp.session_id = p_session_id;

    insert into public.session_pairs (
      session_id,
      pair_label,
      player_a_id,
      player_b_id,
      roster_a_id,
      roster_b_id
    ) values (
      p_session_id,
      v_label,
      v_profile_a,
      v_profile_b,
      v_roster_a,
      v_roster_b
    );
  end loop;
end;
$body$;

grant execute on function public.sync_competition_pairs(uuid, jsonb) to anon, authenticated;

create or replace function public.assign_competition_round(p_round_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_entries uuid[];
  v_courts uuid[];
  v_court_idx int := 1;
  v_batch uuid[];
  v_shuffled uuid[];
  v_court_id uuid;
  v_i int;
  v_player_mode text;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;

  v_player_mode := coalesce(v_session.scoring_config->>'competition_player_mode', 'singles');

  if v_player_mode = 'duos'
    or v_session.partnership_mode = 'americano'
    or coalesce(v_session.rules, '') ilike '%americano%' then
    perform public.assign_ranked_americano_round(p_round_id, p_session_id);
    return;
  end if;

  delete from public.competition_round_players where round_id = p_round_id;

  select coalesce(array_agg(sp.id order by random()), '{}')
  into v_entries
  from public.session_players sp
  where sp.session_id = p_session_id;

  select coalesce(array_agg(c.id order by c.sort_order), '{}')
  into v_courts
  from public.courts c
  where c.is_active;

  if coalesce(array_length(v_courts, 1), 0) = 0 then
    raise exception 'No active courts';
  end if;

  while coalesce(array_length(v_entries, 1), 0) >= 4 loop
    v_batch := v_entries[1:4];
    v_entries := v_entries[5:coalesce(array_length(v_entries, 1), 0)];

    select coalesce(array_agg(x order by random()), '{}')
    into v_shuffled
    from unnest(v_batch) as x;

    v_court_id := v_courts[v_court_idx];
    v_court_idx := v_court_idx + 1;
    if v_court_idx > coalesce(array_length(v_courts, 1), 0) then
      v_court_idx := 1;
    end if;

    for v_i in 1..2 loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
      from public.session_players sp
      where sp.id = v_shuffled[v_i];
    end loop;
    for v_i in 3..4 loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
      from public.session_players sp
      where sp.id = v_shuffled[v_i];
    end loop;
  end loop;
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
  v_break_min int;
  v_game_min int;
  v_slot_min int;
  v_total_rounds int;
  v_round_id uuid;
  v_i int;
  v_is_scored boolean;
  v_player_mode text;
  v_duration_min numeric;
  v_min_players int;
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

  v_player_mode := coalesce(v_session.scoring_config->>'competition_player_mode', 'singles');
  v_min_players := case when v_player_mode = 'duos' then 12 else 4 end;

  if (select count(*) from public.session_players where session_id = p_session_id) < v_min_players then
    raise exception 'Need at least % players', v_min_players;
  end if;

  v_is_scored := v_player_mode = 'duos'
    or v_session.partnership_mode = 'americano'
    or coalesce(v_session.rules, '') ilike '%americano%';

  v_break_min := greatest(0, coalesce((v_session.scoring_config->>'break_minutes')::int, 3));
  v_total_rounds := greatest(1, coalesce((v_session.scoring_config->>'americano_games')::int, 7));
  v_duration_min := extract(epoch from (v_session.ends_at - v_session.starts_at)) / 60.0;

  if not v_is_scored then
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

create or replace function public.create_duo_league(
  p_season_id uuid,
  p_title text,
  p_skill_level text,
  p_gender text,
  p_slots jsonb,
  p_pairs jsonb,
  p_scoring_config jsonb,
  p_created_by uuid default null
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
  v_fields jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

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
      12,
      12,
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

grant execute on function public.create_duo_league(uuid, text, text, text, jsonb, jsonb, jsonb, uuid) to authenticated;

create or replace function public.update_league_week_schedule(
  p_session_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.game_group_id is null then
    raise exception 'Not a league week';
  end if;

  update public.game_sessions
  set
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    starts_on = (p_starts_at at time zone 'Asia/Bangkok')::date,
    ends_on = (p_ends_at at time zone 'Asia/Bangkok')::date,
    status = case when status = 'draft' then 'open' else status end
  where id = p_session_id;
end;
$body$;

grant execute on function public.update_league_week_schedule(uuid, timestamptz, timestamptz) to authenticated;

-- Include draft duo-league weeks in admin setup list (dates set later).
create or replace function public.list_competitions_for_setup()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      to_jsonb(gs) || jsonb_build_object(
        'session_players',
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', sp.id,
            'profile_id', sp.profile_id,
            'padel_player_id', sp.padel_player_id,
            'guest_name', sp.guest_name,
            'guest_email', sp.guest_email,
            'rank_order', sp.rank_order,
            'profiles', case when pr.id is null then null
              else jsonb_build_object(
                'id', pr.id,
                'display_name', pr.display_name,
                'avatar_url', pr.avatar_url
              ) end
          ) order by sp.rank_order nulls last, sp.id), '[]'::jsonb)
          from public.session_players sp
          left join public.profiles pr on pr.id = sp.profile_id
          where sp.session_id = gs.id
        )
      )
      order by gs.starts_at nulls last, gs.starts_on nulls last
    ),
    '[]'::jsonb
  )
  from public.game_sessions gs
  where gs.game_kind = 'competition'
    and (
      gs.status in ('open', 'locked', 'complete')
      or (gs.status = 'draft' and gs.game_group_id is not null)
    );
$$;

notify pgrst, 'reload schema';
