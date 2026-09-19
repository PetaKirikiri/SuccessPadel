-- The public match-log SELECT policy checks friendly_sessions. Without an
-- anonymous SELECT policy on that parent, Realtime filters out public scores.
-- These same public session fields are already exposed by get_friendly_session.
-- No write privileges or private-session access are added here.
drop policy if exists friendly_sessions_select_public_anon on public.friendly_sessions;
create policy friendly_sessions_select_public_anon
  on public.friendly_sessions for select to anon
  using (visibility = 'public');
