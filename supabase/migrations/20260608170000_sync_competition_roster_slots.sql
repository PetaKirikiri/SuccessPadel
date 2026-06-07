-- Replace guest roster from fixed slot list (#1 = rank 0, strongest first).

create or replace function public.sync_competition_roster_slots(
  p_session_id uuid,
  p_names text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_i int;
  v_name text;
  v_email text;
  v_cap int;
  v_count int := 0;
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

  v_cap := coalesce(v_session.max_players, v_session.target_players, 4);

  for v_i in 1..coalesce(array_length(p_names, 1), 0) loop
    if btrim(p_names[v_i]) <> '' then
      v_count := v_count + 1;
    end if;
  end loop;

  if v_session.player_cap_mode is distinct from 'flexible' and v_count > v_cap then
    raise exception 'Competition is full';
  end if;

  create temp table _old_guests on commit drop as
  select rank_order, guest_name, guest_email
  from public.session_players
  where session_id = p_session_id
    and guest_name is not null;

  delete from public.session_players
  where session_id = p_session_id
    and guest_name is not null;

  for v_i in 1..coalesce(array_length(p_names, 1), 0) loop
    v_name := btrim(p_names[v_i]);
    if v_name <> '' then
      select og.guest_email into v_email
      from _old_guests og
      where og.rank_order = v_i - 1
        and og.guest_name = v_name
      limit 1;

      insert into public.session_players (session_id, guest_name, guest_email, rank_order)
      values (p_session_id, v_name, v_email, v_i - 1);
    end if;
  end loop;
end;
$body$;

grant execute on function public.sync_competition_roster_slots(uuid, text[]) to authenticated;
