-- Scores should never decide when the organiser moves to another game.
-- Keep the existing call sites harmless so every score-saving path behaves
-- consistently, while the explicit advance_competition_round RPC remains.
create or replace function public.try_auto_advance_competition_round(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  return;
end;
$body$;

comment on function public.try_auto_advance_competition_round(uuid) is
  'Intentionally does nothing. Competition rounds advance only through an explicit organiser action.';

grant execute on function public.try_auto_advance_competition_round(uuid) to authenticated;
