-- Live multi-device sync for gesture-pad games: realtime + link-based reads.

-- Anyone authenticated (with the link) can watch a friendly game's live log.
create policy match_gesture_logs_select_friendly on public.match_gesture_logs
  for select
  to authenticated
  using (friendly_session_id is not null);

-- Stream row changes to subscribed clients (RLS still applies per subscriber).
do $$
begin
  alter publication supabase_realtime add table public.match_gesture_logs;
exception
  when duplicate_object then null;
end
$$;
