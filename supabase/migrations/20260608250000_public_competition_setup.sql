-- Setup page (/competitions): list, edit roster, publish — no login required.

create or replace function public.list_competitions_for_setup()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      to_jsonb(gs) || jsonb_build_object(
        'session_players',
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', sp.id,
            'profile_id', sp.profile_id,
            'guest_name', sp.guest_name,
            'guest_email', sp.guest_email,
            'rank_order', sp.rank_order,
            'profiles', case when pr.id is null then null
              else jsonb_build_object('id', pr.id, 'display_name', pr.display_name) end
          ) order by sp.rank_order nulls last, sp.id), '[]'::jsonb)
          from public.session_players sp
          left join public.profiles pr on pr.id = sp.profile_id
          where sp.session_id = gs.id
        )
      )
      order by gs.starts_at nulls last, gs.starts_on nulls last
    ),
    '[]'::jsonb
  )
  from public.game_sessions gs
  where gs.game_kind = 'competition'
    and gs.status in ('open', 'locked', 'complete');
$$;

create or replace function public.list_setup_courts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('name', c.name, 'sort_order', c.sort_order) order by c.sort_order),
    '[]'::jsonb
  )
  from public.courts c
  where c.is_active;
$$;

create or replace function public.save_competition_scoring_config(
  p_session_id uuid,
  p_scoring_config jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  update public.game_sessions
  set scoring_config = p_scoring_config
  where id = p_session_id
    and game_kind = 'competition'
    and status = 'open'
    and competition_started_at is null;

  if not found then
    raise exception 'Cannot update competition config';
  end if;
end;
$body$;

create or replace function public.delete_competition_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  delete from public.game_sessions
  where id = p_session_id and game_kind = 'competition';

  if not found then
    raise exception 'Competition not found';
  end if;
end;
$body$;

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

create or replace function public.start_competition(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_break_min int := 1;
  v_game_min int := 14;
  v_slot_min int := 15;
  v_total_rounds int := 8;
  v_round_id uuid;
  v_i int;
  v_is_americano boolean;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'open' then
    raise exception 'Competition must be open';
  end if;
  if v_session.starts_at is null or v_session.ends_at is null then
    raise exception 'Start and end time required';
  end if;

  if (select count(*) from public.session_players where session_id = p_session_id) < 4 then
    raise exception 'Need at least 4 players';
  end if;

  v_is_americano := v_session.partnership_mode = 'americano'
    or coalesce(v_session.rules, '') ilike '%americano%';

  if not v_is_americano then
    v_game_min := 15;
    v_slot_min := v_game_min + v_break_min;
    v_total_rounds := greatest(1, (
      (extract(epoch from (v_session.ends_at - v_session.starts_at)) / 60.0)::int + v_break_min
    ) / v_slot_min);
  end if;

  delete from public.competition_rounds where session_id = p_session_id;

  for v_i in 1..v_total_rounds loop
    insert into public.competition_rounds (
      session_id, round_number, is_final, starts_at, ends_at, status
    ) values (
      p_session_id,
      v_i,
      v_i = v_total_rounds,
      v_session.starts_at + ((v_i - 1) * v_slot_min) * interval '1 minute',
      v_session.starts_at + (((v_i - 1) * v_slot_min) + v_game_min) * interval '1 minute',
      case when v_i = 1 then 'active' else 'pending' end
    )
    returning id into v_round_id;

    perform public.assign_competition_round(v_round_id, p_session_id);
  end loop;

  update public.game_sessions
  set status = 'locked', competition_started_at = now()
  where id = p_session_id;
end;
$body$;

grant execute on function public.list_competitions_for_setup() to anon, authenticated;
grant execute on function public.list_setup_courts() to anon, authenticated;
grant execute on function public.save_competition_scoring_config(uuid, jsonb) to anon, authenticated;
grant execute on function public.delete_competition_session(uuid) to anon, authenticated;
grant execute on function public.sync_competition_roster_slots(uuid, text[]) to anon, authenticated;
grant execute on function public.start_competition(uuid) to anon, authenticated;
