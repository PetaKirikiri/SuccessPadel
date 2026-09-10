-- The draw is a plan of fixed roster slots. Reorder the occupants, not the draw.
create or replace function public.reorder_competition_slot_occupants(
  p_session_id uuid, p_expected_slots jsonb, p_occupant_order uuid[]
) returns void language plpgsql security invoker set search_path = public as $$
declare
  s public.game_sessions%rowtype;
  snapshot jsonb;
  slot_ids uuid[];
  target_id uuid;
  occupant jsonb;
  i integer;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Only competition administrators can reorder the lineup';
  end if;
  select * into s from public.game_sessions where id=p_session_id for update;
  if not found or s.game_kind <> 'competition' or s.status = 'complete' then
    raise exception 'Competition is unavailable or complete';
  end if;
  if s.partnership_mode is distinct from 'americano' then
    raise exception 'This control reorders singles; fixed teams must stay together';
  end if;
  perform 1 from public.session_players where session_id=p_session_id order by id for update;
  select jsonb_agg(jsonb_build_object('id',id,'profile_id',profile_id,
    'padel_player_id',padel_player_id,'guest_name',guest_name,'guest_email',guest_email,
    'rank_order',rank_order) order by rank_order,id), array_agg(id order by rank_order,id)
    into snapshot,slot_ids from public.session_players where session_id=p_session_id;
  if snapshot is distinct from p_expected_slots then
    raise exception 'The lineup was changed elsewhere. Refresh before trying again';
  end if;
  if cardinality(slot_ids) is null or cardinality(p_occupant_order) is distinct from cardinality(slot_ids)
    or array_position(p_occupant_order,null) is not null
    or (select count(distinct id) from unnest(p_occupant_order) as x(id)) <> cardinality(slot_ids)
    or not p_occupant_order @> slot_ids then
    raise exception 'The new order must contain every existing player exactly once';
  end if;
  if p_occupant_order = slot_ids then return; end if;
  -- Temporarily detach member identities to avoid the unique member-per-session
  -- index during swaps. The transaction exposes only the finished lineup.
  update public.session_players set profile_id=null, guest_name='Reordering player'
    where session_id=p_session_id;
  for i in 1..cardinality(slot_ids) loop
    target_id := slot_ids[i];
    select value into occupant from jsonb_array_elements(snapshot)
      where (value->>'id')::uuid = p_occupant_order[i];
    update public.session_players set
      profile_id=(occupant->>'profile_id')::uuid,
      padel_player_id=(occupant->>'padel_player_id')::uuid,
      guest_name=occupant->>'guest_name', guest_email=occupant->>'guest_email'
      where id=target_id;
    update public.competition_round_players set profile_id=(occupant->>'profile_id')::uuid
      where roster_entry_id=target_id and profile_id is distinct from (occupant->>'profile_id')::uuid;
  end loop;
  -- No rank_order, slot ID, court, team, round timestamp, schedule JSON or score
  -- updates. Existing match_players remain the historical scoring authority.
end $$;
revoke all on function public.reorder_competition_slot_occupants(uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.reorder_competition_slot_occupants(uuid,jsonb,uuid[]) to authenticated;
notify pgrst, 'reload schema';
