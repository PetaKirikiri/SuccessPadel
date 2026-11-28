revoke all on public.booking_calendar_records from public, anon, authenticated;
-- The original update grant was column-scoped.
revoke update (records, revision) on public.booking_calendar_records from authenticated;
