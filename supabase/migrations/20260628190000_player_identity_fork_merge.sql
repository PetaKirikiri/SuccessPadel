-- Detect and safely merge padel_players forks that share the same resolved display name.

create or replace function public.normalize_resolved_display_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.padel_player_resolved_name(p_padel_player_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.display_name, pp.display_name)
  from public.padel_players pp
  left join public.profiles p on p.id = pp.profile_id
  where pp.id = p_padel_player_id
$$;

create or replace function public.padel_player_dominance_score(p_padel_player_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select
    (case when coalesce(p.line_user_id, pp.line_user_id) is not null
      and btrim(coalesce(p.line_user_id, pp.line_user_id, '')) <> '' then 100 else 0 end)
    + (case when p.avatar_url is not null and btrim(p.avatar_url) <> '' then 50 else 0 end)
    + (case when pp.profile_id is not null then 30 else 0 end)
    + (case when pp.linked_at is not null then 10 else 0 end)
    + coalesce((
        select count(*)::int
        from (
          select sp.id from public.session_players sp where sp.padel_player_id = pp.id
          union all
          select mp.id from public.match_players mp where mp.padel_player_id = pp.id
        ) refs
      ), 0)
  from public.padel_players pp
  left join public.profiles p on p.id = pp.profile_id
  where pp.id = p_padel_player_id
$$;

create or replace function public.padel_player_reference_counts(p_padel_player_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'session_players', (select count(*)::int from public.session_players sp where sp.padel_player_id = p_padel_player_id),
    'match_players', (select count(*)::int from public.match_players mp where mp.padel_player_id = p_padel_player_id),
    'line_handoff_tokens', (select count(*)::int from public.player_line_handoff_tokens t where t.padel_player_id = p_padel_player_id),
    'line_link_requests', (select count(*)::int from public.player_line_link_requests r where r.padel_player_id = p_padel_player_id)
  )
$$;

create or replace function public.list_player_identity_fork_groups()
returns table (
  normalized_name text,
  fork_count int,
  suggested_dominant_padel_player_id uuid,
  records jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with resolved as (
    select
      pp.id as padel_player_id,
      pp.display_name as padel_player_name,
      pp.profile_id as padel_profile_id,
      pp.line_user_id as padel_line_user_id,
      pp.linked_at,
      pp.created_at,
      p.id as profile_id,
      p.display_name as profile_name,
      p.avatar_url,
      p.line_user_id as profile_line_user_id,
      public.normalize_resolved_display_name(coalesce(p.display_name, pp.display_name)) as normalized_name,
      public.padel_player_dominance_score(pp.id) as dominance_score,
      public.padel_player_reference_counts(pp.id) as refs
    from public.padel_players pp
    left join public.profiles p on p.id = pp.profile_id
    where coalesce(p.display_name, pp.display_name) is not null
      and trim(coalesce(p.display_name, pp.display_name)) <> ''
  ),
  grouped as (
    select
      r.normalized_name,
      count(*)::int as fork_count,
      jsonb_agg(
        jsonb_build_object(
          'padel_player_id', r.padel_player_id,
          'padel_player_name', r.padel_player_name,
          'padel_profile_id', r.padel_profile_id,
          'profile_id', r.profile_id,
          'profile_name', r.profile_name,
          'avatar_url', r.avatar_url,
          'line_user_id', coalesce(r.profile_line_user_id, r.padel_line_user_id),
          'linked_at', r.linked_at,
          'created_at', r.created_at,
          'dominance_score', r.dominance_score,
          'references', r.refs
        )
        order by r.dominance_score desc, r.created_at
      ) as records,
      (array_agg(r.padel_player_id order by r.dominance_score desc, r.created_at))[1] as suggested_dominant_padel_player_id
    from resolved r
    group by r.normalized_name
    having count(*) > 1
  )
  select
    g.normalized_name,
    g.fork_count,
    g.suggested_dominant_padel_player_id,
    g.records
  from grouped g
  order by g.fork_count desc, g.normalized_name
$$;

create or replace function public.preview_merge_padel_players(
  p_dominant_padel_player_id uuid,
  p_absorb_padel_player_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $body$
declare
  v_dominant record;
  v_absorb uuid;
  v_actions jsonb := '[]'::jsonb;
  v_sp record;
  v_existing uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select pp.id, pp.profile_id, coalesce(p.display_name, pp.display_name) as resolved_name
  into v_dominant
  from public.padel_players pp
  left join public.profiles p on p.id = pp.profile_id
  where pp.id = p_dominant_padel_player_id;

  if not found then
    raise exception 'Dominant padel_player not found';
  end if;

  foreach v_absorb in array coalesce(p_absorb_padel_player_ids, '{}'::uuid[]) loop
    if v_absorb = p_dominant_padel_player_id then
      continue;
    end if;
    if not exists (select 1 from public.padel_players where id = v_absorb) then
      v_actions := v_actions || jsonb_build_array(jsonb_build_object(
        'absorb_padel_player_id', v_absorb,
        'action', 'skip_missing'
      ));
      continue;
    end if;

    for v_sp in
      select sp.id, sp.session_id
      from public.session_players sp
      where sp.padel_player_id = v_absorb
    loop
      select sp2.id into v_existing
      from public.session_players sp2
      where sp2.session_id = v_sp.session_id
        and (
          sp2.padel_player_id = p_dominant_padel_player_id
          or (v_dominant.profile_id is not null and sp2.profile_id = v_dominant.profile_id)
        )
      limit 1;

      if v_existing is not null then
        v_actions := v_actions || jsonb_build_array(jsonb_build_object(
          'absorb_padel_player_id', v_absorb,
          'action', 'merge_session_player_row',
          'from_session_player_id', v_sp.id,
          'into_session_player_id', v_existing,
          'session_id', v_sp.session_id
        ));
      else
        v_actions := v_actions || jsonb_build_array(jsonb_build_object(
          'absorb_padel_player_id', v_absorb,
          'action', 'reassign_session_player_row',
          'session_player_id', v_sp.id,
          'session_id', v_sp.session_id,
          'to_padel_player_id', p_dominant_padel_player_id,
          'to_profile_id', v_dominant.profile_id
        ));
      end if;
    end loop;

    v_actions := v_actions || jsonb_build_array(jsonb_build_object(
      'absorb_padel_player_id', v_absorb,
      'action', 'reassign_match_players',
      'count', (select count(*) from public.match_players mp where mp.padel_player_id = v_absorb)
    ));

    v_actions := v_actions || jsonb_build_array(jsonb_build_object(
      'absorb_padel_player_id', v_absorb,
      'action', 'delete_padel_player_row_if_unreferenced'
    ));
  end loop;

  return jsonb_build_object(
    'dominant_padel_player_id', p_dominant_padel_player_id,
    'dominant_profile_id', v_dominant.profile_id,
    'resolved_name', v_dominant.resolved_name,
    'actions', v_actions
  );
end;
$body$;

create or replace function public.merge_padel_players_into_dominant(
  p_dominant_padel_player_id uuid,
  p_absorb_padel_player_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_dominant record;
  v_absorb uuid;
  v_sp record;
  v_existing uuid;
  v_merged int := 0;
  v_deleted int := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select pp.id, pp.profile_id, coalesce(p.display_name, pp.display_name) as resolved_name
  into v_dominant
  from public.padel_players pp
  left join public.profiles p on p.id = pp.profile_id
  where pp.id = p_dominant_padel_player_id;

  if not found then
    raise exception 'Dominant padel_player not found';
  end if;

  foreach v_absorb in array coalesce(p_absorb_padel_player_ids, '{}'::uuid[]) loop
    if v_absorb = p_dominant_padel_player_id then
      continue;
    end if;
    if not exists (select 1 from public.padel_players where id = v_absorb) then
      continue;
    end if;

    if public.player_is_line_linked(v_absorb, null) and v_absorb <> p_dominant_padel_player_id then
      raise exception 'Refusing to absorb LINE-linked padel_player %', v_absorb;
    end if;

    for v_sp in
      select sp.id, sp.session_id
      from public.session_players sp
      where sp.padel_player_id = v_absorb
    loop
      select sp2.id into v_existing
      from public.session_players sp2
      where sp2.session_id = v_sp.session_id
        and (
          sp2.padel_player_id = p_dominant_padel_player_id
          or (v_dominant.profile_id is not null and sp2.profile_id = v_dominant.profile_id)
        )
      limit 1;

      if v_existing is not null then
        update public.competition_round_players
        set roster_entry_id = v_existing
        where roster_entry_id = v_sp.id;

        update public.match_players
        set roster_entry_id = v_existing
        where roster_entry_id = v_sp.id;

        delete from public.session_players where id = v_sp.id;
        v_merged := v_merged + 1;
      else
        update public.session_players sp
        set
          padel_player_id = p_dominant_padel_player_id,
          profile_id = coalesce(v_dominant.profile_id, sp.profile_id),
          guest_name = case when v_dominant.profile_id is not null then null else sp.guest_name end
        where sp.id = v_sp.id;
        v_merged := v_merged + 1;
      end if;
    end loop;

    update public.match_players mp
    set
      padel_player_id = p_dominant_padel_player_id,
      profile_id = coalesce(v_dominant.profile_id, mp.profile_id)
    where mp.padel_player_id = v_absorb;

    update public.player_line_handoff_tokens
    set padel_player_id = p_dominant_padel_player_id
    where padel_player_id = v_absorb;

    update public.player_line_link_requests
    set padel_player_id = p_dominant_padel_player_id
    where padel_player_id = v_absorb;

    delete from public.padel_players pp
    where pp.id = v_absorb
      and not exists (select 1 from public.session_players sp where sp.padel_player_id = pp.id)
      and not exists (select 1 from public.match_players mp where mp.padel_player_id = pp.id);

    if found then
      v_deleted := v_deleted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'dominant_padel_player_id', p_dominant_padel_player_id,
    'resolved_name', v_dominant.resolved_name,
    'session_rows_merged_or_reassigned', v_merged,
    'absorbed_padel_players_deleted', v_deleted
  );
end;
$body$;

grant execute on function public.normalize_resolved_display_name(text) to authenticated;
grant execute on function public.padel_player_resolved_name(uuid) to authenticated;
grant execute on function public.padel_player_dominance_score(uuid) to authenticated;
grant execute on function public.padel_player_reference_counts(uuid) to authenticated;
grant execute on function public.list_player_identity_fork_groups() to authenticated;
grant execute on function public.preview_merge_padel_players(uuid, uuid[]) to authenticated;
grant execute on function public.merge_padel_players_into_dominant(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
