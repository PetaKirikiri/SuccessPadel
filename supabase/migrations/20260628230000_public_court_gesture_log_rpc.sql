-- Anon-safe read for spectator scorer UI (bypasses RLS edge cases on direct select).

create or replace function public.get_public_court_gesture_log(p_court_setup_key text)
returns setof public.match_gesture_logs
language sql
security definer
set search_path = public
as $$
  select m.*
  from public.match_gesture_logs m
  join public.friendly_sessions fs on fs.id = m.friendly_session_id
  where m.court_setup_key = p_court_setup_key
    and fs.visibility = 'public';
$$;

grant execute on function public.get_public_court_gesture_log(text) to anon, authenticated;

notify pgrst, 'reload schema';
