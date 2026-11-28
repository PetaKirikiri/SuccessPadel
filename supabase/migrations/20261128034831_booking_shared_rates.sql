-- Live rates are shared across staff browsers and public reservations.
create table public.booking_rates (
  code text primary key,
  amount integer not null check (amount >= 0)
);

insert into public.booking_rates (code, amount) values
  ('outdoorRegular',800), ('outdoorMember',400),
  ('indoorRegular',1000), ('indoorMember',800), ('outdoorDaytime',600),
  ('coaching',2000), ('coachingMatch',2400),
  ('coachingFive',9000), ('coachingPackage',15000),
  ('privatePilates',1500), ('duoPilates',2200), ('groupPilates',800),
  ('privatePackage',6500), ('groupPackage',2950), ('annualMembership',3500),
  ('racketRental',100), ('ballRental',100);

alter table public.booking_rates enable row level security;
revoke all on public.booking_rates from public, anon, authenticated;
grant select, update (amount) on public.booking_rates to authenticated;

create policy booking_staff_read_rates on public.booking_rates
  for select to authenticated using (exists (
    select 1 from public.booking_member_roster where id = 1
  ));

create policy booking_owner_update_rates on public.booking_rates
  for update to authenticated using (
    exists (select 1 from public.booking_staff_access where role = 'owner')
    and ((select auth.jwt()->>'aal') = 'aal2' or (select booking_private.has_google_session()))
  ) with check (
    exists (select 1 from public.booking_staff_access where role = 'owner')
    and ((select auth.jwt()->>'aal') = 'aal2' or (select booking_private.has_google_session()))
  );

create or replace function booking_guest.dispatch(payload text, signature text) returns jsonb
language plpgsql security definer set search_path='' as $$
<<dispatch>>
declare
  expected text; args jsonb; visit date; sport text; action text; calendar jsonb; offers jsonb;
  slot record; storage_key text; name text; entry jsonb; request_id uuid;
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
    -- Publish only the occupied interval and its non-identifying display category.
    return jsonb_build_object('slots',offers,'rates',(
      select jsonb_object_agg(r.code,r.amount) from public.booking_rates r
      where r.code in ('outdoorRegular','indoorRegular','coaching','privatePilates','duoPilates','groupPilates')
    ),'occupied',(
      with entries as (
        select b from jsonb_array_elements(calendar->('success-'||sport||'-bookings')) b
        union all
        select b from public.booking_demo_samples d, jsonb_array_elements(d.dataset->'bookings') b
        where d.id=1 and sport='padel' and b->>'eventType'='competition' and b->>'weeklyOngoing'='true'
      ), positions as (
        select distinct r resource,(extract(epoch from (b->>'time')::time)/60)::int as minute,(b->>'duration')::int duration,
          case
            when sport='pilates' then 'pilates'
            when b->>'eventType'='competition' then 'competition'
            when nullif(b->>'eventId','') is not null then 'event'
            when b->>'product'='coaching-match' then 'coaching-match'
            when nullif(b->>'coach','') is not null or b->>'activity'='coaching' then 'lesson'
            else 'play'
          end kind
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
  fingerprint:=encode(extensions.digest((args-array['issued','requester','expectedPrice'])::text,'sha256'),'hex');
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
  storage_key:=case sport when 'padel' then 'success-padel-bookings' else 'success-pilates-bookings' end;
  select r.amount into strict price from public.booking_rates r
  where r.code = case slot.kind
    when 'play' then case when slot.resource<=2 then 'outdoorRegular' else 'indoorRegular' end
    when 'coaching' then 'coaching'
    when 'private' then 'privatePilates'
    when 'duo' then 'duoPilates'
    when 'group' then 'groupPilates'
  end;
  if slot.kind='play' then price:=round(price*slot.duration/60.0,2); end if;
  if args?'expectedPrice' and (args->>'expectedPrice')::numeric is distinct from price
    then raise exception 'Price changed' using errcode='PT412'; end if;
  entry:=jsonb_build_object('id',request_id,'createdAt',now(),'bookedBy','Online booking','date',visit,
    'time',to_char(time '00:00'+slot.minute*interval '1 minute','HH24:MI'),'duration',slot.duration,
    'customer',name,'customerId',null,'paid',false,'requestedPaymentMethod',coalesce(args->>'method','later'),'price',price);
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
