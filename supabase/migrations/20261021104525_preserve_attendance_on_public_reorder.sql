-- The draw is a plan of fixed roster slots. Reorder the occupants, not the draw.
create or replace function public.public_competition_signup_reorder(
  p_session_id uuid, p_expected_slots jsonb, p_occupant_order uuid[]
) returns void language plpgsql security invoker set search_path = public as $$
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
end $$;
revoke all on function public.public_competition_signup_reorder(uuid,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.public_competition_signup_reorder(uuid,jsonb,uuid[]) to service_role;
notify pgrst, 'reload schema';
