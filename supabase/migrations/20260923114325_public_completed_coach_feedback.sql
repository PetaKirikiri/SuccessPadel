-- Completed coaching comments are public profile content. Do not expose
-- processing/error rows or grant visitors any recording/edit/delete capability.
begin;
alter table public.player_coach_observations enable row level security;
grant select (id, player_id, coach_id, created_at, transcript, feedback, status)
  on public.player_coach_observations to anon;
create policy coach_observations_public_completed
  on public.player_coach_observations for select
  to anon, authenticated
  using (status = 'complete');
commit;
