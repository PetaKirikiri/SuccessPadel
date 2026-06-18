-- Sync duos pairs via the roster RPC (already in PostgREST cache) and grant pair sync to anon.

drop function if exists public.sync_competition_roster_slots(uuid, jsonb);

create or replace function public.sync_competition_roster_slots(
  p_session_id uuid,
  p_slots jsonb,
  p_pairs jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_i int;
  v_slot jsonb;
  v_name text;
  v_profile_id uuid;
  v_padel_id uuid;
  v_cap int;
  v_count int := 0;
  v_len int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;

  if v_session.status = 'complete' then
    raise exception 'Competition is complete';
  end if;

  v_cap := coalesce(v_session.max_players, v_session.target_players, 4);
  v_len := coalesce(jsonb_array_length(p_slots), 0);

  for v_i in 0..v_len - 1 loop
    v_slot := p_slots->v_i;
    v_name := btrim(coalesce(v_slot->>'name', ''));
    if v_name <> '' then
      v_count := v_count + 1;
    end if;
  end loop;

  if v_session.player_cap_mode is distinct from 'flexible' and v_count > v_cap then
    raise exception 'Competition is full';
  end if;

  delete from public.session_players where session_id = p_session_id;

  for v_i in 0..v_len - 1 loop
    v_slot := p_slots->v_i;
    v_name := btrim(coalesce(v_slot->>'name', ''));
    if v_name = '' then
      continue;
    end if;

    v_profile_id := nullif(v_slot->>'profile_id', '')::uuid;
    v_padel_id := nullif(v_slot->>'padel_player_id', '')::uuid;

    if v_profile_id is not null then
      if not exists (select 1 from public.profiles p where p.id = v_profile_id) then
        raise exception 'Profile not found';
      end if;
      v_padel_id := public.find_or_create_padel_player(v_name, null, v_profile_id);
      insert into public.session_players (session_id, profile_id, rank_order, padel_player_id, guest_name)
      values (p_session_id, v_profile_id, v_i, v_padel_id, null);
    elsif v_padel_id is not null then
      if not exists (
        select 1 from public.padel_players pp
        where pp.id = v_padel_id and pp.profile_id is null
      ) then
        raise exception 'Player profile not found';
      end if;
      insert into public.session_players (session_id, guest_name, rank_order, padel_player_id)
      values (p_session_id, v_name, v_i, v_padel_id);
    else
      v_padel_id := public.find_or_create_padel_player(v_name, null, null);
      insert into public.session_players (session_id, guest_name, rank_order, padel_player_id)
      values (p_session_id, v_name, v_i, v_padel_id);
    end if;
  end loop;

  if p_pairs is not null then
    perform public.sync_competition_pairs(p_session_id, p_pairs);
  end if;
end;
$body$;

grant execute on function public.sync_competition_roster_slots(uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.sync_competition_pairs(uuid, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
