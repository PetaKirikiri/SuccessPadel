-- Runs in one transaction and leaves no accounts, bookings, or sessions behind.
begin;
insert into auth.users(id, aud, role, is_anonymous) select ('b0000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'authenticated','authenticated',false from generate_series(1,5) n;
insert into public.coaching_sessions(id,capacity,price_thb,booking_open) values('__coaching_test__',4,500,true);
set local role anon;
do $$ begin
  if (public.coaching_booking_status('__coaching_test__')->>'places_left')::int <> 4 then raise exception 'Bad public count'; end if;
  begin perform public.book_coaching_place('__coaching_test__'); raise exception 'Guest booking allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.coaching_bookings; raise exception 'Guest can read bookings'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare result jsonb; begin
  result := public.book_coaching_place('__coaching_test__');
  if (result->>'places_left')::int <> 3 or not (result->>'booked')::bool then raise exception 'First booking not reflected: %',result; end if;
  result := public.book_coaching_place('__coaching_test__');
  if (result->>'places_left')::int <> 3 then raise exception 'Duplicate consumes space'; end if;
  begin insert into public.coaching_bookings values('__coaching_test__','b0000000-0000-4000-8000-000000000002',now()); raise exception 'Direct insert allowed'; exception when insufficient_privilege then null; end;
  begin update public.coaching_sessions set capacity=99 where id='__coaching_test__'; raise exception 'Capacity edit allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.coaching_bookings where session_id='__coaching_test__') then raise exception 'Other account booking exposed'; end if;
  if (public.coaching_booking_status('__coaching_test__')->>'booked')::bool then raise exception 'Other account status exposed'; end if;
  perform public.book_coaching_place('__coaching_test__');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.book_coaching_place('__coaching_test__');
reset role;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select public.book_coaching_place('__coaching_test__');
reset role;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.book_coaching_place('__coaching_test__'); raise exception 'Fifth booking allowed'; exception when raise_exception then if sqlerrm <> 'CLASS_FULL' then raise; end if; end;
end $$;
reset role;
update public.coaching_sessions set booking_open=false where id='__coaching_test__';
set local role authenticated;
do $$ begin
  begin perform public.book_coaching_place('__coaching_test__'); raise exception 'Closed booking allowed'; exception when raise_exception then if sqlerrm <> 'BOOKING_CLOSED' then raise; end if; end;
end $$;
reset role;
update auth.users set is_anonymous=true where id='b0000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$ begin
  begin perform public.book_coaching_place('__coaching_test__'); raise exception 'Anonymous account allowed'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
rollback;
select 'PASS: capacity, duplicate, privacy, grants, closed class, anonymous account; fixtures rolled back' as result;
