-- TV / game card: read all gesture logs for a public friendly session (anon-safe).

create or replace function public.get_public_friendly_match_logs(p_session_id uuid)
returns setof public.match_gesture_logs
language sql
security definer
set search_path = public
as $$
  select m.*
  from public.match_gesture_logs m
  join public.friendly_sessions fs on fs.id = m.friendly_session_id
  where m.friendly_session_id = p_session_id
    and fs.visibility = 'public'
  order by m.updated_at desc;
$$;

grant execute on function public.get_public_friendly_match_logs(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
