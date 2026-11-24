create table public.booking_calendar_records (
  id integer primary key check (id = 1),
  revision integer not null default 0,
  records jsonb not null check (jsonb_typeof(records) = 'object')
);
alter table public.booking_calendar_records enable row level security;
revoke all on public.booking_calendar_records from public, anon, authenticated;
grant select, update(records,revision) on public.booking_calendar_records to authenticated;
create policy booking_calendar_staff on public.booking_calendar_records
  for all to authenticated using (exists (select 1 from public.booking_member_roster where id = 1))
  with check (exists (select 1 from public.booking_member_roster where id = 1));
insert into public.booking_calendar_records(id,records) values
  (1,'{"success-coach-availability":[{"coach":"Peta","date":"2026-11-24","time":"21:00","duration":60}]}');
