-- One-time merge of padel_players forks detected by resolved display name.
-- Dominant = LINE-linked profile identity; absorb = guest or stub fork.

create or replace function public._merge_padel_players_datafix(
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
  select pp.id, pp.profile_id, coalesce(p.display_name, pp.display_name) as resolved_name
  into v_dominant
  from public.padel_players pp
  left join public.profiles p on p.id = pp.profile_id
  where pp.id = p_dominant_padel_player_id;

  if not found then
    raise exception 'Dominant padel_player not found: %', p_dominant_padel_player_id;
  end if;

  foreach v_absorb in array coalesce(p_absorb_padel_player_ids, '{}'::uuid[]) loop
    if v_absorb = p_dominant_padel_player_id then
      continue;
    end if;
    if not exists (select 1 from public.padel_players where id = v_absorb) then
      continue;
    end if;

    if public.player_is_line_linked(v_absorb, null) then
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

    update public.competition_round_players crp
    set profile_id = coalesce(v_dominant.profile_id, crp.profile_id)
    where crp.profile_id in (
      select pp.profile_id from public.padel_players pp where pp.id = v_absorb and pp.profile_id is not null
    );

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

do $$
declare
  v_result jsonb;
  v_orphan uuid;
begin
  -- tong: TongSuccess (LINE) absorbs stub Tong
  v_result := public._merge_padel_players_datafix(
    '8de7dc87-abb1-4fc5-956b-47ff19e4ad2a',
    array['3209ea11-0ea0-41ce-974c-02db1b4c891f']::uuid[]
  );
  raise notice 'tong: %', v_result;

  -- som: LINE Som absorbs guest Som
  v_result := public._merge_padel_players_datafix(
    '553da5ea-d21f-49b9-b77b-20a82bfa502b',
    array['8b6d012c-8656-44d6-bfac-3d84595889bb']::uuid[]
  );
  raise notice 'som: %', v_result;

  -- neung
  v_result := public._merge_padel_players_datafix(
    '28dc0033-2404-48bc-8b86-c8341b6d26dc',
    array['6164b806-e6fe-4daf-9b1a-b1cde0d839a4']::uuid[]
  );
  raise notice 'neung: %', v_result;

  -- ae
  v_result := public._merge_padel_players_datafix(
    '907ba8a0-e770-4c71-a9b3-9c2b3af8b603',
    array['59579131-3fb8-4092-ac96-7069b36ba4e0']::uuid[]
  );
  raise notice 'ae: %', v_result;

  -- aew
  v_result := public._merge_padel_players_datafix(
    '46c3f13b-d407-46d4-a91f-a4f530290ac8',
    array['7f71ec8b-c9ed-409c-8bc0-0dbcf29a745f']::uuid[]
  );
  raise notice 'aew: %', v_result;

  -- nam
  v_result := public._merge_padel_players_datafix(
    '3e4f4e09-0cf8-4d68-80d9-4e60ecec091a',
    array['5ca27f93-f64d-41e3-8b37-5e8d0027f35a']::uuid[]
  );
  raise notice 'nam: %', v_result;

  -- pai
  v_result := public._merge_padel_players_datafix(
    'cad9545a-4613-45d8-806b-dc470d6a2689',
    array['865338b7-fcf6-4de2-9c2c-a48b690d312e']::uuid[]
  );
  raise notice 'pai: %', v_result;

  -- Delete orphan stub profiles left with no references (e.g. Tong stub)
  for v_orphan in
    select p.id
    from public.profiles p
    where p.line_user_id is null
      and not exists (select 1 from public.padel_players pp where pp.profile_id = p.id)
      and not exists (select 1 from public.session_players sp where sp.profile_id = p.id)
      and not exists (select 1 from public.match_players mp where mp.profile_id = p.id)
      and not exists (select 1 from public.competition_round_players crp where crp.profile_id = p.id)
      and not exists (select 1 from public.game_sessions gs where gs.created_by = p.id)
      and not exists (select 1 from public.matches m where m.created_by = p.id)
  loop
    delete from public.profiles where id = v_orphan;
    raise notice 'deleted orphan profile %', v_orphan;
  end loop;
end $$;

drop function if exists public._merge_padel_players_datafix(uuid, uuid[]);
