-- Add identity evidence to the existing public competition response only.
-- No player, schedule, score, permission, or scoring calculation changes.
do $migration$
declare
  definition text := pg_get_functiondef('public.get_public_competition(uuid)'::regprocedure);
  needle text := '''team'', mp.team, ''is_winner'', mp.is_winner,';
  replacement text := '''team'', mp.team, ''is_winner'', mp.is_winner,
              ''roster_entry_id'', mp.roster_entry_id,
              ''profile_id'', mp.profile_id,';
begin
  if position(replacement in definition) > 0 then return; end if;
  if position(needle in definition) = 0 then
    raise exception 'Unexpected competition response definition; refusing to replace';
  end if;
  execute replace(definition, needle, replacement);
end
$migration$;
