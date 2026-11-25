create or replace function booking_guest.dispatch(payload text, signature text) returns jsonb
language plpgsql security definer set search_path='' as $$
<<dispatch>>
declare
  expected text; args jsonb; visit date; sport text; action text; calendar jsonb; offers jsonb;
  slot record; storage_key text; name text; member_id text; entry jsonb; request_id uuid;
  fingerprint text; previous text; requester text; price numeric;
begin
  if octet_length(payload)>4096 then raise exception 'Invalid request'; end if;
  select encode(extensions.hmac('booking-guest-v1:'||payload,secret,'sha256'),'hex') into expected
    from booking_private.google_secret where singleton;
  if signature is null or expected is null or extensions.digest(signature,'sha256')<>extensions.digest(expected,'sha256')
    then raise exception 'Invalid signature' using errcode='42501'; end if;
  args:=payload::jsonb;
  if abs(extract(epoch from clock_timestamp())-(args->>'issued')::bigint)>90 or not args?'issued'
    then raise exception 'Expired request'; end if;
  visit:=(args->>'date')::date; sport:=args->>'activity'; action:=args->>'action';
  if visit is null or sport is null or sport not in ('padel','pilates') then raise exception 'Invalid calendar'; end if;
  if action in ('slots','calendar') then
    select records into strict calendar from public.booking_calendar_records where id=1;
    select coalesce(jsonb_agg(to_jsonb(o)),'[]') into offers from booking_guest.offers(visit,sport,calendar) o;
    if action='slots' then return offers; end if;
    -- Only the position and length of each occupied interval leave the database.
    return jsonb_build_object('slots',offers,'occupied',(
      with entries as (
        select b from jsonb_array_elements(calendar->('success-'||sport||'-bookings')) b
        union all
        select b from public.booking_demo_samples d, jsonb_array_elements(d.dataset->'bookings') b
        where d.id=1 and sport='padel' and b->>'eventType'='competition' and b->>'weeklyOngoing'='true'
      ), positions as (
        select distinct r resource,(extract(epoch from (b->>'time')::time)/60)::int as minute,(b->>'duration')::int duration
        from entries cross join generate_series(1,4) r
        where b->>case sport when 'padel' then 'court' else 'room' end =
          (case sport when 'padel' then 'Court ' else 'Room ' end || r)
          and (b->>'date'=visit::text or (b->>'weeklyOngoing'='true' and visit>=(b->>'date')::date and (visit-(b->>'date')::date)%7=0))
      ) select coalesce(jsonb_agg(to_jsonb(p)),'[]') from positions p
    ));
  end if;
  if action is distinct from 'reserve' then raise exception 'Invalid action'; end if;
  name:=btrim(args->>'name'); request_id:=(args->>'id')::uuid; requester:=args->>'requester';
  if request_id is null or name is null or length(name) not between 1 and 80 or name ~ '[[:cntrl:]<>&"]'
     or requester is null or requester !~ '^[0-9a-f]{64}$' then raise exception 'Invalid guest'; end if;
  if coalesce(args->>'method','later') not in ('later','test-card','test-qr','test-true','cash') then raise exception 'Invalid method'; end if;
  if args?'players' then
    if jsonb_typeof(args->'players')<>'array' or jsonb_array_length(args->'players')>3 then raise exception 'Invalid players'; end if;
    if exists(select from jsonb_array_elements(args->'players') p where jsonb_typeof(p)<>'string'
      or length(btrim(p#>>'{}')) not between 1 and 80 or (p#>>'{}') ~ '[[:cntrl:]<>&"]') then raise exception 'Invalid player'; end if;
  end if;
  -- Staff also compare this row's revision when saving. Serialize both court and coach assignment.
  select records into strict calendar from public.booking_calendar_records where id=1 for update;
  fingerprint:=encode(extensions.digest((args-array['issued','requester'])::text,'sha256'),'hex');
  select c.fingerprint into previous from booking_guest.confirmations c where c.id=request_id;
  if found then
    if previous<>fingerprint then raise exception 'Slot unavailable' using errcode='PT409'; end if;
    return jsonb_build_object('reference',request_id);
  end if;
  if (select count(*) from booking_guest.confirmations c where c.requester=dispatch.requester and c.created_at>now()-interval '10 minutes')>=6
    then raise exception 'Try again later' using errcode='PT429'; end if;
  select * into slot from booking_guest.offers(visit,sport,calendar) o where o.resource=(args->>'resource')::int
    and o.minute=(args->>'minute')::int and o.kind=args->>'kind' and o.coach is not distinct from (args->>'coach');
  if not found then raise exception 'Slot unavailable' using errcode='PT409'; end if;
  select case when count(*)=1 then min(m->>'id') end into member_id from public.booking_member_roster r,
    jsonb_array_elements(r.members) m where r.id=1 and lower(btrim(m->>'name'))=lower(name)
    and coalesce(m->>'deleted','false')='false';
  storage_key:=case sport when 'padel' then 'success-padel-bookings' else 'success-pilates-bookings' end;
  price:=case slot.kind when 'play' then (case when slot.resource<=2 then 800 else 1000 end)*slot.duration/60.0
    when 'coaching' then 2000 when 'private' then 1500 when 'duo' then 2200 when 'group' then 800 end;
  entry:=jsonb_build_object('id',request_id,'createdAt',now(),'bookedBy','Online booking','date',visit,
    'time',to_char(time '00:00'+slot.minute*interval '1 minute','HH24:MI'),'duration',slot.duration,
    'customer',name,'customerId',member_id,'paid',false,'requestedPaymentMethod',coalesce(args->>'method','later'),'price',price);
  if sport='padel' then
    entry:=entry||jsonb_build_object('court','Court '||slot.resource,'activity',slot.kind,'coach',slot.coach,
      'product',case when slot.kind='coaching' then 'normal-coaching' end,'membership','Non-member','players',coalesce(args->'players','[]'::jsonb));
  else
    entry:=entry||jsonb_build_object('room','Room '||slot.resource,'service',slot.kind);
  end if;
  update public.booking_calendar_records set records=jsonb_set(calendar,array[storage_key],
    coalesce(calendar->storage_key,'[]'::jsonb)||jsonb_build_array(entry)), revision=revision+1 where id=1;
  insert into booking_guest.confirmations values(request_id,fingerprint,requester,now());
  return jsonb_build_object('reference',request_id);
end;
$$;
