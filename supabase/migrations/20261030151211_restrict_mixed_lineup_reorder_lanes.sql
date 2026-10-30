-- The saved mixed groups own lane membership. Reordering changes occupants,
-- never group IDs or the draw. Both public and administrator saves enforce it.
create or replace function public.validate_mixed_lineup_order(
  p_config jsonb, p_slots uuid[], p_order uuid[]
) returns void language plpgsql immutable security invoker set search_path = public
as $function$
declare
  groups jsonb := p_config->'mixed_groups';
  members text[];
  group_value jsonb;
  i integer;
begin
  if p_config->>'operation_format' is distinct from 'mixed-americano' then return; end if;
  if jsonb_typeof(groups) is distinct from 'array' then
    raise exception 'Mixed lineup groups are missing or invalid';
  end if;
  if jsonb_array_length(groups) <> 2 then
    raise exception 'Mixed lineup groups are missing or invalid';
  end if;
  for group_value in select value from jsonb_array_elements(groups) loop
    if jsonb_typeof(group_value) is distinct from 'array' then
      raise exception 'Mixed lineup groups are missing or invalid';
    end if;
    if jsonb_array_length(group_value) = 0 then
      raise exception 'Mixed lineup groups are missing or invalid';
    end if;
  end loop;
  select array_agg(member) into members
    from jsonb_array_elements(groups) g(value)
    cross join lateral jsonb_array_elements_text(g.value) m(member);
  if cardinality(members) is distinct from cardinality(p_slots)
    or (select count(distinct member) from unnest(members) m(member)) <> cardinality(p_slots)
    or not members @> p_slots::text[] then
    raise exception 'Mixed lineup groups are missing or invalid';
  end if;
  for i in 1..cardinality(p_slots) loop
    select value into group_value from jsonb_array_elements(groups)
      where value ? p_slots[i]::text;
    if not coalesce(group_value ? p_order[i]::text, false) then
      raise exception 'Players must stay within their own mixed lineup column';
    end if;
  end loop;
end $function$;
revoke all on function public.validate_mixed_lineup_order(jsonb,uuid[],uuid[]) from public, anon;
grant execute on function public.validate_mixed_lineup_order(jsonb,uuid[],uuid[]) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.public_competition_signup_reorder(p_session_id uuid, p_expected_slots jsonb, p_occupant_order uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  s public.game_sessions%rowtype;
  snapshot jsonb;
  public_snapshot jsonb;
  attendance_snapshot jsonb;
  before_roster jsonb;
  before_pairs jsonb;
  slot_ids uuid[];
  target_id uuid;
  occupant jsonb;
  i integer;
begin
  select * into s from public.game_sessions where id=p_session_id for update;
  if not found or s.game_kind <> 'competition' or s.status <> 'open'
    or s.competition_started_at is not null or s.starts_on < (now() at time zone 'Asia/Bangkok')::date
    or exists(select 1 from public.competition_rounds where session_id=p_session_id)
    or exists(select 1 from public.matches where session_id=p_session_id) then
    raise exception 'Registration is closed';
  end if;
  if s.partnership_mode is distinct from 'americano'
    or s.scoring_config->>'competition_player_mode' = 'duos'
    or exists(select 1 from public.session_pairs where session_id=p_session_id) then
    raise exception 'This control reorders singles; fixed teams must stay together';
  end if;
  if (select count(*) from public.competition_signup_history
      where session_id=p_session_id and changed_at>now()-interval '1 minute') >= 60 then
    raise exception 'Too many edits. Please wait a minute';
  end if;
  perform 1 from public.session_players where session_id=p_session_id order by id for update;
  select jsonb_agg(jsonb_build_object('id',id,'profile_id',profile_id,
    'padel_player_id',padel_player_id,'guest_name',guest_name,'guest_email',guest_email,
    'rank_order',rank_order) order by rank_order,id), array_agg(id order by rank_order,id)
    into snapshot,slot_ids from public.session_players where session_id=p_session_id;
  select jsonb_agg(value - 'guest_email') into public_snapshot from jsonb_array_elements(snapshot);
  if public_snapshot is distinct from p_expected_slots then
    raise exception 'The lineup was changed elsewhere. Refresh before trying again';
  end if;
  if cardinality(slot_ids) is null or cardinality(p_occupant_order) is distinct from cardinality(slot_ids)
    or array_position(p_occupant_order,null) is not null
    or (select count(distinct id) from unnest(p_occupant_order) as x(id)) <> cardinality(slot_ids)
    or not p_occupant_order @> slot_ids then
    raise exception 'The new order must contain every existing player exactly once';
  end if;
  perform public.validate_mixed_lineup_order(s.scoring_config, slot_ids, p_occupant_order);
  if p_occupant_order = slot_ids then return; end if;
  select jsonb_agg(to_jsonb(p)) into before_roster from public.session_players p where session_id=p_session_id;
  select coalesce(jsonb_agg(to_jsonb(p)), '[]') into before_pairs from public.session_pairs p where session_id=p_session_id;
  -- Lock every attendance slot before copying statuses with the occupants.
  insert into public.competition_attendance(roster_entry_id,session_id,status)
    select id,p_session_id,'pending' from public.session_players where session_id=p_session_id
    order by id on conflict(roster_entry_id) do nothing;
  perform 1 from public.competition_attendance where session_id=p_session_id order by roster_entry_id for update;
  select jsonb_object_agg(roster_entry_id,to_jsonb(a)) into attendance_snapshot
    from public.competition_attendance a where session_id=p_session_id;
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
    update public.competition_attendance set
      status=attendance_snapshot->(p_occupant_order[i]::text)->>'status',
      updated_at=(attendance_snapshot->(p_occupant_order[i]::text)->>'updated_at')::timestamptz
      where roster_entry_id=target_id;

  end loop;
  insert into public.competition_signup_history(session_id,before_roster,before_pairs,changes)
    values(p_session_id,before_roster,before_pairs,jsonb_build_object('action','reorder','occupant_order',p_occupant_order,'before_attendance',attendance_snapshot));
  -- No rank_order, slot ID, court, team, round timestamp, schedule JSON or score
  -- updates. Existing match_players remain the historical scoring authority.
end $function$
;

CREATE OR REPLACE FUNCTION public.reorder_competition_slot_occupants(p_session_id uuid, p_expected_slots jsonb, p_occupant_order uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  perform public.validate_mixed_lineup_order(s.scoring_config, slot_ids, p_occupant_order);
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
end $function$
;
