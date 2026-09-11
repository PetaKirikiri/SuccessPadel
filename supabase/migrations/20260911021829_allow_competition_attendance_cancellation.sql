-- Keep the existing public attendance contract and permissions unchanged.
-- Only extend the allowed response; do not delete/reorder players or regenerate rounds.
do $migration$
declare
  definition text := pg_get_functiondef('public.set_competition_attendance(uuid,uuid,text)'::regprocedure);
  old_guard text := 'if p_status not in (''pending'', ''confirmed'') then';
  new_guard text := 'if p_status is null or p_status not in (''pending'', ''confirmed'', ''cancelled'') then';
begin
  if position(new_guard in definition) > 0 then
    return;
  end if;
  if position(old_guard in definition) = 0 then
    raise exception 'Attendance function has changed: inspect its validation before applying this migration.';
  end if;
  definition := replace(definition, old_guard, new_guard);
  definition := replace(definition, 'Attendance status must be pending or confirmed.',
    'Attendance status must be pending, confirmed or cancelled.');
  execute definition;
end
$migration$;

notify pgrst, 'reload schema';
