-- Public competition scorer/TV surfaces need live partial gesture scores.
-- A scorer with the gesture-score URL is allowed to write via upsert_match_gesture_log;
-- signed-out TV/view-along clients must also be able to read those rows via RLS/realtime.

grant select on public.match_gesture_logs to anon;

create policy match_gesture_logs_select_public_competition_anon
  on public.match_gesture_logs
  for select
  to anon
  using (
    competition_id is not null
    and exists (
      select 1
      from public.game_sessions gs
      where gs.id::text = match_gesture_logs.competition_id
        and gs.game_kind = 'competition'
        and gs.status in ('locked', 'complete')
        and gs.competition_started_at is not null
    )
  );

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
    and fs.visibility = 'public'

  union all

  select m.*
  from public.match_gesture_logs m
  join public.game_sessions gs on gs.id::text = m.competition_id
  where m.court_setup_key = p_court_setup_key
    and gs.game_kind = 'competition'
    and gs.status in ('locked', 'complete')
    and gs.competition_started_at is not null;
$$;

grant execute on function public.get_public_court_gesture_log(text) to anon, authenticated;

notify pgrst, 'reload schema';
