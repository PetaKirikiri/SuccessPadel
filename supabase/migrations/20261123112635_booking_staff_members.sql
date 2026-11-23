create table public.booking_staff_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'front_desk'))
);

alter table public.booking_staff_access enable row level security;
revoke all on public.booking_staff_access from public, anon, authenticated;
grant select on public.booking_staff_access to authenticated;
create policy "Staff can check their own access" on public.booking_staff_access
  for select to authenticated using (user_id = (select auth.uid()));

create table public.booking_member_roster (
  id integer primary key check (id = 1),
  revision integer not null default 0 check (revision >= 0),
  members jsonb not null default '[]' check (jsonb_typeof(members) = 'array')
);
insert into public.booking_member_roster (id) values (1);

alter table public.booking_member_roster enable row level security;
revoke all on public.booking_member_roster from public, anon, authenticated;
grant select, update (members, revision) on public.booking_member_roster to authenticated;
create policy "Staff can read the booking roster" on public.booking_member_roster
  for select to authenticated using (exists (
    select 1 from public.booking_staff_access
    where role = 'front_desk' or (role = 'owner' and (select auth.jwt()->>'aal') = 'aal2')
  ));
create policy "Staff can update the booking roster" on public.booking_member_roster
  for update to authenticated using (exists (
    select 1 from public.booking_staff_access
    where role = 'front_desk' or (role = 'owner' and (select auth.jwt()->>'aal') = 'aal2')
  ));

create table public.booking_coach_loan (
  id integer primary key check (id = 1),
  revision integer not null default 0 check (revision >= 0),
  ledger jsonb not null default '{"entries":[]}' check (jsonb_typeof(ledger) = 'object')
);
insert into public.booking_coach_loan (id) values (1);
alter table public.booking_coach_loan enable row level security;
revoke all on public.booking_coach_loan from public, anon, authenticated;
grant select, update (ledger, revision) on public.booking_coach_loan to authenticated;
create policy "Verified owners manage coach loans" on public.booking_coach_loan
  for all to authenticated using (
    (select auth.jwt()->>'aal') = 'aal2' and
    exists (select 1 from public.booking_staff_access where role = 'owner')
  );
