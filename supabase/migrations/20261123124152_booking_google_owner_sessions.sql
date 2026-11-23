create schema if not exists booking_private;
revoke all on schema booking_private from public, anon, authenticated;
grant usage on schema booking_private to authenticated;

create table booking_private.google_secret (
  singleton boolean primary key check (singleton),
  secret text not null
);
create table booking_private.google_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null,
  expires_at bigint not null
);
revoke all on all tables in schema booking_private from public, anon, authenticated;

create function booking_private.accept_google_session(proof text, expires bigint)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := (auth.jwt()->>'session_id')::uuid;
  now_seconds bigint := extract(epoch from now())::bigint;
  expected text;
begin
  if uid is null or sid is null or expires <= now_seconds or expires > now_seconds + 3600
     or not exists (select 1 from auth.sessions where id = sid and user_id = uid) then
    return false;
  end if;
  select encode(extensions.hmac('booking-google-v1:' || uid || ':' || sid || ':' || expires, secret, 'sha256'),'hex')
    into expected from booking_private.google_secret where singleton;
  if expected is null or proof is null or length(proof) <> 64 or
     extensions.digest(proof,'sha256') <> extensions.digest(expected,'sha256') then
    return false;
  end if;
  insert into public.booking_staff_access (user_id, role) values (uid, 'owner') on conflict do nothing;
  if not exists (select 1 from public.booking_staff_access where user_id = uid and role = 'owner') then
    return false;
  end if;
  insert into booking_private.google_sessions (session_id, user_id, expires_at)
    values (sid, uid, expires)
    on conflict (session_id) do update set expires_at = excluded.expires_at;
  return true;
end;
$$;

create function booking_private.has_google_session()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from booking_private.google_sessions g
    join auth.sessions s on s.id = g.session_id and s.user_id = g.user_id
    where g.user_id = auth.uid() and g.session_id = (auth.jwt()->>'session_id')::uuid
      and g.expires_at > extract(epoch from now())
  );
$$;

create function public.booking_accept_google_session(proof text, expires bigint)
returns boolean language sql security invoker set search_path = ''
as $$ select booking_private.accept_google_session(proof, expires); $$;

create function public.booking_has_google_session()
returns boolean language sql stable security invoker set search_path = ''
as $$ select booking_private.has_google_session(); $$;

revoke all on function booking_private.accept_google_session(text,bigint), booking_private.has_google_session(),
  public.booking_accept_google_session(text,bigint), public.booking_has_google_session() from public, anon, authenticated;
grant execute on function booking_private.accept_google_session(text,bigint), booking_private.has_google_session(),
  public.booking_accept_google_session(text,bigint), public.booking_has_google_session() to authenticated;

alter policy "Staff can read the booking roster" on public.booking_member_roster using (exists (
  select 1 from public.booking_staff_access where role = 'front_desk'
    or (role = 'owner' and ((select auth.jwt()->>'aal') = 'aal2' or (select booking_private.has_google_session())))
));
alter policy "Staff can update the booking roster" on public.booking_member_roster using (exists (
  select 1 from public.booking_staff_access where role = 'front_desk'
    or (role = 'owner' and ((select auth.jwt()->>'aal') = 'aal2' or (select booking_private.has_google_session())))
));
alter policy "Verified owners manage coach loans" on public.booking_coach_loan using (
  ((select auth.jwt()->>'aal') = 'aal2' or (select booking_private.has_google_session()))
  and exists (select 1 from public.booking_staff_access where role = 'owner')
);
