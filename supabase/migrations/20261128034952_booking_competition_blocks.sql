-- Staff use the same recurring competition records that currently block guest reservations.
-- Only event display and scheduling fields cross the privilege boundary.
create or replace function booking_private.staff_competition_blocks() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', entry->'date', 'court', entry->'court', 'time', entry->'time',
    'duration', entry->'duration', 'customer', entry->'customer',
    'activity', 'event', 'eventType', 'competition', 'eventId', entry->'eventId',
    'eventRepeat', 'weekly', 'weeklyOngoing', true
  )), '[]'::jsonb)
  from public.booking_demo_samples sample
  cross join lateral jsonb_array_elements(sample.dataset->'bookings') entry
  where sample.id = 1 and entry->>'eventType' = 'competition'
    and entry->'weeklyOngoing' = 'true'::jsonb
    and exists (
      select 1 from public.booking_staff_access staff
      where staff.user_id = (select auth.uid())
    );
$$;

create or replace function public.booking_competition_blocks() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select booking_private.staff_competition_blocks(); $$;

revoke all on function booking_private.staff_competition_blocks() from public, anon, authenticated;
revoke all on function public.booking_competition_blocks() from public, anon, authenticated;
grant execute on function booking_private.staff_competition_blocks() to authenticated;
grant execute on function public.booking_competition_blocks() to authenticated;
