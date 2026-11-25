begin;
create schema booking_guest;
revoke all on schema booking_guest from public;
-- No Data API table grants. Only the signed server request can use the entrypoint.
grant usage on schema booking_guest to anon;
create table booking_guest.confirmations (
  id uuid primary key, fingerprint text not null, requester text not null,
  created_at timestamptz not null default now()
);
alter table booking_guest.confirmations enable row level security;
revoke all on booking_guest.confirmations from public, anon, authenticated;
create index on booking_guest.confirmations (requester,created_at);

create function booking_guest.offers(visit date, activity text, calendar jsonb)
returns table(resource int, minute int, duration int, kind text, coach text)
language sql stable set search_path='' as $$
  with bookings as materialized (
    select b from jsonb_array_elements(calendar->case activity when 'padel' then 'success-padel-bookings' else 'success-pilates-bookings' end) b
    union all
    select b from public.booking_demo_samples d, jsonb_array_elements(d.dataset->'bookings') b
    where d.id=1 and activity='padel' and b->>'eventType'='competition' and b->>'weeklyOngoing'='true'
  ), busy as materialized (
    select b->>case activity when 'padel' then 'court' else 'room' end place,
      b->>'service' service,b->>'coach' coach, (b->>'duration')::int length,
      (extract(epoch from (b->>'time')::time)/60)::int start
    from bookings where b->>'date'=visit::text or (b->>'weeklyOngoing'='true'
      and visit>=(b->>'date')::date and (visit-(b->>'date')::date)%7=0)
  ), windows as materialized (
    select w->>'coach' coach,(extract(epoch from (w->>'time')::time)/60)::int start,(w->>'duration')::int length
    from jsonb_array_elements(calendar->'success-coach-availability') w
    where activity='padel' and w->>'date'=visit::text and w->>'coach' in ('Peta','David','Bia','Tong','Neung')
  ), options as (
    select 'play' kind,null::text coach, length from (values(60),(30)) lengths(length) where activity='padel'
    union all select 'coaching',coach,60 from (select distinct coach from windows) a
    union all select service,null,60 from (values('private'),('duo'),('group')) services(service) where activity='pilates'
  )
  select r,m,o.length,o.kind,o.coach
  from generate_series(1,4) r cross join generate_series(420,1290,30) m cross join options o
  where (visit + m * interval '1 minute') at time zone 'Asia/Bangkok' > now()
    and m+o.length<=1320
    and (o.kind<>'play' or o.length=case when m%60=0 then 60 else 30 end)
    and (o.kind<>'coaching' or (r>=3 and not exists (
      select from generate_series(m,m+o.length-15,15) q
      where not exists(select from windows w where w.coach=o.coach and w.start<=q and w.start+w.length>=q+15)
    )))
    and not exists (select from busy b where b.start<m+o.length and b.start+b.length>m
      and (b.coach=o.coach or (b.place=(case activity when 'padel' then 'Court ' else 'Room ' end ||r)
        and (o.kind<>'group' or b.service is distinct from 'group' or b.start<>m or b.length<>o.length))))
    and (o.kind<>'group' or (select count(*) from busy b where b.place='Room '||r and b.start=m and b.service='group')<3)
  order by m,r,o.kind;
$$;
revoke all on function booking_guest.offers(date,text,jsonb) from public,anon,authenticated;

create function booking_guest.dispatch(payload text, signature text) returns jsonb
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
  if action='slots' then
    select records into strict calendar from public.booking_calendar_records where id=1;
    select coalesce(jsonb_agg(to_jsonb(o)),'[]') into offers from booking_guest.offers(visit,sport,calendar) o;
    return offers;
  end if;
  if action is distinct from 'reserve' then raise exception 'Invalid action'; end if;
  name:=btrim(args->>'name'); request_id:=(args->>'id')::uuid; requester:=args->>'requester';
  if request_id is null or name is null or length(name) not between 1 and 80 or name ~ '[[:cntrl:]<>&"]'
     or requester is null or requester !~ '^[0-9a-f]{64}$' then raise exception 'Invalid guest'; end if;
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
    'customer',name,'customerId',member_id,'paid',false,'requestedPaymentMethod','later','price',price);
  if sport='padel' then
    entry:=entry||jsonb_build_object('court','Court '||slot.resource,'activity',slot.kind,'coach',slot.coach,
      'product',case when slot.kind='coaching' then 'normal-coaching' end,'membership','Non-member','players','[]'::jsonb);
  else
    entry:=entry||jsonb_build_object('room','Room '||slot.resource,'service',slot.kind);
  end if;
  update public.booking_calendar_records set records=jsonb_set(calendar,array[storage_key],
    coalesce(calendar->storage_key,'[]'::jsonb)||jsonb_build_array(entry)), revision=revision+1 where id=1;
  insert into booking_guest.confirmations values(request_id,fingerprint,requester,now());
  return jsonb_build_object('reference',request_id);
end;
$$;
create function public.booking_guest_calendar(payload text, signature text) returns jsonb
language sql security invoker set search_path='' as $$
  select booking_guest.dispatch(payload,signature);
$$;
revoke all on function booking_guest.dispatch(text,text),public.booking_guest_calendar(text,text) from public,authenticated;
grant execute on function booking_guest.dispatch(text,text),public.booking_guest_calendar(text,text) to anon;
notify pgrst,'reload schema';
commit;
