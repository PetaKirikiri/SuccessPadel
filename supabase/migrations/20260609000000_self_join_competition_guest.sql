-- Players add themselves by name during open setup (no login required).

create or replace function public.self_join_competition_guest(
  p_session_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_name text;
  v_id uuid;
  v_next_rank int;
begin
  v_name := btrim(p_display_name);
  if v_name = '' then
    raise exception 'Name required';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'open' or v_session.competition_started_at is not null then
    raise exception 'Sign-ups are closed';
  end if;
  if not public.can_join_session(p_session_id) then
    raise exception 'Competition is full';
  end if;

  if exists (
    select 1
    from public.session_players sp
    left join public.profiles pr on pr.id = sp.profile_id
    where sp.session_id = p_session_id
      and lower(btrim(coalesce(sp.guest_name, pr.display_name, ''))) = lower(v_name)
  ) then
    raise exception 'That name is already on the list';
  end if;

  select coalesce(max(rank_order), -1) + 1 into v_next_rank
  from public.session_players
  where session_id = p_session_id;

  insert into public.session_players (session_id, guest_name, rank_order)
  values (p_session_id, v_name, v_next_rank)
  returning id into v_id;

  return v_id;
end;
$body$;

grant execute on function public.self_join_competition_guest(uuid, text) to anon, authenticated;
