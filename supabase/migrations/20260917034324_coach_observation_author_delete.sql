-- Only a currently authorised coach may delete their own completed recording.
-- Keep the existing SELECT policy: DELETE also requires row visibility.
grant delete on public.player_coach_observations to authenticated;
create policy coach_observations_author_delete
on public.player_coach_observations for delete to authenticated
using (
  coach_id = (select auth.uid())
  and (select public.can_record_coach_feedback())
  and status = 'complete'
);
notify pgrst, 'reload schema';
