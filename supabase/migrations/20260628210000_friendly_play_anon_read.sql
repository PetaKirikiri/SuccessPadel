-- TV / view-along: signed-out browsers can load public friendly sessions and scores.

grant execute on function public.get_friendly_session(uuid) to anon;

grant select on public.match_gesture_logs to anon;

create policy match_gesture_logs_select_public_friendly_anon
  on public.match_gesture_logs
  for select
  to anon
  using (
    friendly_session_id is not null
    and exists (
      select 1
      from public.friendly_sessions fs
      where fs.id = match_gesture_logs.friendly_session_id
        and fs.visibility = 'public'
    )
  );

notify pgrst, 'reload schema';
