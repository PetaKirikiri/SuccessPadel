-- Conclude a finished competition: lock final standings so the ranking table is revealed.

alter table public.game_sessions
  add column if not exists competition_concluded_at timestamptz;

create or replace function public.conclude_competition(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'complete' then
    raise exception 'Competition is not finished';
  end if;

  update public.game_sessions
  set competition_concluded_at = now()
  where id = p_session_id;
end;
$body$;

grant execute on function public.conclude_competition(uuid) to authenticated;
