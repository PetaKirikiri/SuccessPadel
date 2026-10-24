-- Coaching uses the existing auth.users identity. No new account system.
create schema if not exists coaching_private;
revoke all on schema coaching_private from public;
grant usage on schema coaching_private to anon, authenticated;

create table public.coaching_sessions (
  id text primary key,
  capacity integer not null check (capacity between 1 and 100),
  price_thb integer not null check (price_thb >= 0),
  starts_at timestamptz,
  booking_open boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.coaching_bookings (
  session_id text not null references public.coaching_sessions(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index coaching_bookings_user on public.coaching_bookings(user_id);
alter table public.coaching_sessions enable row level security;
alter table public.coaching_bookings enable row level security;
revoke all on public.coaching_sessions, public.coaching_bookings from public, anon, authenticated;
grant select on public.coaching_sessions to anon, authenticated;
grant select on public.coaching_bookings to authenticated;
create policy coaching_sessions_read on public.coaching_sessions for select to anon, authenticated using (true);
create policy coaching_bookings_read on public.coaching_bookings for select to authenticated
using (user_id = (select auth.uid()) or (select public.can_record_coach_feedback()));
-- Writes are only possible through the narrow authenticated booking operation.
-- This private definer counts all bookings without exposing other players' identities.
create function coaching_private.booking_status(p_session_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('session_id',s.id,'capacity',s.capacity,'price_thb',s.price_thb,
    'starts_at',s.starts_at,'booking_open',s.booking_open,
    'places_left',greatest(0,s.capacity-(select count(*) from public.coaching_bookings b where b.session_id=s.id)),
    'booked',exists(select 1 from public.coaching_bookings b where b.session_id=s.id and b.user_id=auth.uid()))
  from public.coaching_sessions s where s.id=p_session_id;
$$;
revoke all on function coaching_private.booking_status(text) from public;
grant execute on function coaching_private.booking_status(text) to anon, authenticated;
create function public.coaching_booking_status(p_session_id text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coaching_private.booking_status(p_session_id);
$$;
revoke all on function public.coaching_booking_status(text) from public;
grant execute on function public.coaching_booking_status(text) to anon, authenticated;

create function coaching_private.book_place(p_session_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_session public.coaching_sessions;
begin
  if v_user is null or not exists(select 1 from auth.users where id=v_user and not coalesce(is_anonymous,false)) then
    raise exception 'SIGN_IN_REQUIRED' using errcode='28000';
  end if;
  -- Serialize all capacity checks for this session, including the last place.
  select * into v_session from public.coaching_sessions where id=p_session_id for update;
  if not found then raise exception 'CLASS_UNAVAILABLE' using errcode='P0001'; end if;
  if exists(select 1 from public.coaching_bookings where session_id=p_session_id and user_id=v_user) then
    return coaching_private.booking_status(p_session_id);
  end if;
  if not v_session.booking_open or (v_session.starts_at is not null and v_session.starts_at <= now()) then
    raise exception 'BOOKING_CLOSED' using errcode='P0001';
  end if;
  if (select count(*) from public.coaching_bookings where session_id=p_session_id) >= v_session.capacity then
    raise exception 'CLASS_FULL' using errcode='P0001';
  end if;
  insert into public.coaching_bookings(session_id,user_id) values(p_session_id,v_user);
  return coaching_private.booking_status(p_session_id);
end;
$$;
revoke all on function coaching_private.book_place(text) from public, anon;
grant execute on function coaching_private.book_place(text) to authenticated;
create function public.book_coaching_place(p_session_id text) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  select coaching_private.book_place(p_session_id);
$$;
revoke all on function public.book_coaching_place(text) from public, anon;
grant execute on function public.book_coaching_place(text) to authenticated;

insert into public.coaching_sessions(id,capacity,price_thb,booking_open)
values('first-clinic',4,500,true);
notify pgrst, 'reload schema';
