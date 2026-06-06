-- Bulk-add guest names to a competition roster (no accounts required).

create or replace function public.add_competition_guests(p_session_id uuid, p_names text[])
returns int
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_name text;
  v_added int := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'open' or v_session.competition_started_at is not null then
    raise exception 'Sign-ups are closed';
  end if;

  foreach v_name in array coalesce(p_names, '{}')
  loop
    v_name := btrim(v_name);
    if v_name = '' then
      continue;
    end if;
    if not public.can_join_session(p_session_id) then
      raise exception 'Competition is full';
    end if;

    insert into public.session_players (session_id, guest_name)
    values (p_session_id, v_name);

    v_added := v_added + 1;
  end loop;

  return v_added;
end;
$body$;

grant execute on function public.add_competition_guests(uuid, text[]) to authenticated;
