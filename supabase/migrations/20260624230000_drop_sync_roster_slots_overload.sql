-- PostgREST cannot resolve sync_competition_roster_slots(uuid, jsonb) vs (uuid, jsonb, jsonb default null).

drop function if exists public.sync_competition_roster_slots(uuid, jsonb);

grant execute on function public.sync_competition_roster_slots(uuid, jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
