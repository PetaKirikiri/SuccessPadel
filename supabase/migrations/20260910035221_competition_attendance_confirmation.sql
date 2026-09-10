create table if not exists public.competition_attendance (
  roster_entry_id uuid primary key references public.session_players(id) on delete cascade,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  updated_at timestamptz not null default now()
);

create index if not exists competition_attendance_session_id_idx
  on public.competition_attendance(session_id);

alter table public.competition_attendance enable row level security;

drop policy if exists "Public competition attendance is readable" on public.competition_attendance;
create policy "Public competition attendance is readable"
  on public.competition_attendance
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.game_sessions gs
      where gs.id = competition_attendance.session_id
        and gs.game_kind = 'competition'
        and gs.status in ('open', 'locked', 'complete')
    )
  );

create or replace function public.set_competition_attendance(
  p_session_id uuid,
  p_roster_entry_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.competition_attendance;
begin
  if p_status not in ('pending', 'confirmed') then
    raise exception 'Attendance status must be pending or confirmed.';
  end if;

  if not exists (
    select 1
    from public.game_sessions gs
    where gs.id = p_session_id
      and gs.game_kind = 'competition'
      and gs.status in ('open', 'locked')
      and (gs.ends_at is null or gs.ends_at > now())
  ) then
    raise exception 'This competition is no longer accepting attendance updates.';
  end if;

  if not exists (
    select 1
    from public.session_players sp
    where sp.id = p_roster_entry_id
      and sp.session_id = p_session_id
  ) then
    raise exception 'That player is not registered in this competition.';
  end if;

  insert into public.competition_attendance (roster_entry_id, session_id, status, updated_at)
  values (p_roster_entry_id, p_session_id, p_status, now())
  on conflict (roster_entry_id) do update
    set status = excluded.status,
        updated_at = excluded.updated_at
  returning * into v_result;

  return jsonb_build_object(
    'roster_entry_id', v_result.roster_entry_id,
    'session_id', v_result.session_id,
    'status', v_result.status,
    'updated_at', v_result.updated_at
  );
end;
$$;

revoke all on table public.competition_attendance from public;
grant select on table public.competition_attendance to anon, authenticated;

revoke all on function public.set_competition_attendance(uuid, uuid, text) from public;
grant execute on function public.set_competition_attendance(uuid, uuid, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'competition_attendance'
  ) then
    alter publication supabase_realtime add table public.competition_attendance;
  end if;
end;
$$;

notify pgrst, 'reload schema';
