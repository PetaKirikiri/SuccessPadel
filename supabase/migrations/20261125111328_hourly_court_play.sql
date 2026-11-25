create or replace function booking_guest.offers(visit date, activity text, calendar jsonb)
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
    select 'play' kind,null::text coach, 60 as length where activity='padel'
    union all select 'coaching',coach,60 from (select distinct coach from windows) a
    union all select service,null,60 from (values('private'),('duo'),('group')) services(service) where activity='pilates'
  )
  select r,m,o.length,o.kind,o.coach
  from generate_series(1,4) r cross join generate_series(420,1290,30) m cross join options o
  where (visit + m * interval '1 minute') at time zone 'Asia/Bangkok' > now()
    and m+o.length<=1320
    and (o.kind<>'play' or m%60=0)
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
