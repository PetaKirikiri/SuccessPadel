-- Completed coach notes are already public. Allow the Review tab to filter them
-- by their recorded event, without changing row policies or write permissions.
grant select (competition_id) on public.player_coach_observations to anon;
