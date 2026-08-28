-- Let public competition displays receive score and round changes immediately.
-- This mirrors get_public_competition(): competition sessions are public, while
-- friendly/private court sessions remain unavailable to anonymous clients.

create or replace function public.is_public_competition_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select gs.game_kind = 'competition'
      from public.game_sessions gs
      where gs.id = p_session_id
    ),
    false
  );
$$;

grant execute on function public.is_public_competition_session(uuid) to anon, authenticated;

drop policy if exists game_sessions_public_competition_select on public.game_sessions;
create policy game_sessions_public_competition_select on public.game_sessions
  for select to anon
  using (public.is_public_competition_session(id));

drop policy if exists competition_rounds_public_competition_select on public.competition_rounds;
create policy competition_rounds_public_competition_select on public.competition_rounds
  for select to anon
  using (public.is_public_competition_session(session_id));

drop policy if exists matches_public_competition_select on public.matches;
create policy matches_public_competition_select on public.matches
  for select to anon
  using (public.is_public_competition_session(session_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_sessions'
  ) then
    alter publication supabase_realtime add table public.game_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'competition_rounds'
  ) then
    alter publication supabase_realtime add table public.competition_rounds;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end
$$;
