-- Break RLS recursion between game_sessions_select and game_slots_select.
create or replace function public.can_view_game_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        gs.game_kind = 'competition'
        or gs.visibility = 'open'
        or public.is_admin()
        or exists (
          select 1
          from public.session_players sp
          where sp.session_id = gs.id
            and sp.profile_id = auth.uid()
        )
        or exists (
          select 1
          from public.game_slots gsl
          join public.slot_players sp on sp.slot_id = gsl.id
          where gsl.session_id = gs.id
            and sp.profile_id = auth.uid()
        )
      from public.game_sessions gs
      where gs.id = p_session_id
    ),
    false
  );
$$;

grant execute on function public.can_view_game_session(uuid) to authenticated;

drop policy if exists game_sessions_select on public.game_sessions;
create policy game_sessions_select on public.game_sessions
  for select to authenticated
  using (public.can_view_game_session(id));

drop policy if exists game_slots_select on public.game_slots;
create policy game_slots_select on public.game_slots
  for select to authenticated
  using (public.can_view_game_session(session_id));
