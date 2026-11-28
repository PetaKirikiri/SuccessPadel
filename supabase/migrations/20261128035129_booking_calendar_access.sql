-- Keep hidden owner fields attached to legacy bookings even when staff reschedule them.
do $$
declare
  booking_key text;
begin
  foreach booking_key in array array['success-padel-bookings','success-pilates-bookings'] loop
    update public.booking_calendar_records calendar
    set records = jsonb_set(calendar.records, array[booking_key], (
      select jsonb_agg(
        case when nullif(entry->>'id','') is null
                  and entry ?| array['coachPayoutAmount','salesBilled','salesReceipts']
          then entry || jsonb_build_object('id',gen_random_uuid())
          else entry end order by position
      )
      from jsonb_array_elements(calendar.records->booking_key) with ordinality as bookings(entry, position)
    )), revision = calendar.revision + 1
    where exists (
      select 1 from jsonb_array_elements(calendar.records->booking_key) entry
      where nullif(entry->>'id','') is null
        and entry ?| array['coachPayoutAmount','salesBilled','salesReceipts']
    );
  end loop;
end;
$$;

-- Calendar access needs both a verified staff session and a server signature.
-- Guests continue to use the separate public calendar projection.
create function public.booking_staff_calendar(request text, signature text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  args jsonb := request::jsonb;
  actor_role text;
  expected text;
  result jsonb;
begin
  select access.role into actor_role
  from public.booking_staff_access access where access.user_id = actor;
  if actor_role is null or args->>'actor' is distinct from actor::text
    or (actor_role = 'owner' and coalesce(auth.jwt()->>'aal', '') <> 'aal2'
      and not booking_private.has_google_session())
    or coalesce(abs(extract(epoch from clock_timestamp()) - (args->>'issued')::bigint) > 60, true)
  then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  select encode(extensions.hmac('booking-staff-calendar-v1:' || request, secret, 'sha256'), 'hex')
  into expected from booking_private.google_secret where singleton;
  if signature is null or expected is null
    or extensions.digest(signature, 'sha256') <> extensions.digest(expected, 'sha256')
  then
    raise exception 'Invalid calendar signature' using errcode = '42501';
  end if;

  case args->>'action'
    when 'read' then
      select jsonb_build_object('records', records, 'revision', revision)
      into strict result from public.booking_calendar_records where id = 1;
    when 'write' then
      if jsonb_typeof(args->'records') is distinct from 'object' then
        raise exception 'Invalid calendar records';
      end if;
      update public.booking_calendar_records set records = args->'records', revision = revision + 1
      where id = 1 and revision = (args->>'revision')::int
      returning jsonb_build_object('revision', revision) into result;
    else raise exception 'Invalid calendar action';
  end case;
  return result;
end;
$$;

revoke execute on function public.booking_staff_calendar(text, text) from public, anon, authenticated;
grant execute on function public.booking_staff_calendar(text, text) to authenticated;
