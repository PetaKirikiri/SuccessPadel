-- Competition live rounds: 15-minute blocks, random court assignments, final round at end.

create table public.competition_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  round_number int not null,
  is_final boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'complete')),
  created_at timestamptz not null default now(),
  unique (session_id, round_number)
);

create index competition_rounds_session_id_idx on public.competition_rounds (session_id);

create table public.competition_round_players (
  round_id uuid not null references public.competition_rounds (id) on delete cascade,
  court_id uuid not null references public.courts (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  team public.match_team not null,
  primary key (round_id, profile_id)
);

create index competition_round_players_round_id_idx on public.competition_round_players (round_id);

alter table public.game_sessions
  add column if not exists competition_started_at timestamptz;

alter table public.competition_rounds enable row level security;
alter table public.competition_round_players enable row level security;

create policy competition_rounds_select on public.competition_rounds
  for select to authenticated
  using (public.can_view_game_session(session_id));

create policy competition_rounds_admin on public.competition_rounds
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy competition_round_players_select on public.competition_round_players
  for select to authenticated
  using (
    exists (
      select 1 from public.competition_rounds cr
      where cr.id = round_id and public.can_view_game_session(cr.session_id)
    )
  );

create policy competition_round_players_admin on public.competition_round_players
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Allow match logging while competition is in progress (locked).
create or replace function public.record_match(
  p_session_id uuid,
  p_score_summary text,
  p_players jsonb,
  p_notes text default null,
  p_round_number int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_match_id uuid;
  v_player jsonb;
  v_profile_id uuid;
  v_team public.match_team;
  v_is_winner boolean;
  v_margin_bonus boolean := false;
  v_ids uuid[] := '{}';
  v_pair_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then
    raise exception 'Session not found';
  end if;
  if v_session.status not in ('open', 'locked') then
    raise exception 'Session is not open for scoring';
  end if;

  if jsonb_array_length(p_players) <> 4 then
    raise exception 'Exactly 4 players required';
  end if;

  for v_player in select * from jsonb_array_elements(p_players)
  loop
    v_profile_id := (v_player ->> 'profile_id')::uuid;
    v_ids := array_append(v_ids, v_profile_id);
    if not exists (
      select 1 from public.session_players sp
      where sp.session_id = p_session_id and sp.profile_id = v_profile_id
    ) then
      raise exception 'Player % not on roster', v_profile_id;
    end if;
  end loop;

  if v_session.partnership_mode = 'fixed_pairs' then
    select count(*) = 2 into v_pair_ok
    from (
      select sp.id
      from public.session_pairs sp
      where sp.session_id = p_session_id
        and sp.player_a_id = any(v_ids) and sp.player_b_id = any(v_ids)
    ) t;
    if not v_pair_ok then
      raise exception 'Teams must match registered pairs';
    end if;
  end if;

  v_margin_bonus := coalesce((p_players -> 0 ->> 'margin_bonus_earned')::boolean, false)
    or coalesce((p_players -> 1 ->> 'margin_bonus_earned')::boolean, false)
    or coalesce((p_players -> 2 ->> 'margin_bonus_earned')::boolean, false)
    or coalesce((p_players -> 3 ->> 'margin_bonus_earned')::boolean, false);

  insert into public.matches (session_id, score_summary, notes, round_number, created_by)
  values (p_session_id, p_score_summary, p_notes, p_round_number, auth.uid())
  returning id into v_match_id;

  for v_player in select * from jsonb_array_elements(p_players)
  loop
    v_profile_id := (v_player ->> 'profile_id')::uuid;
    v_team := (v_player ->> 'team')::public.match_team;
    v_is_winner := coalesce((v_player ->> 'is_winner')::boolean, false);
    insert into public.match_players (match_id, profile_id, team, is_winner, points_earned)
    values (
      v_match_id,
      v_profile_id,
      v_team,
      v_is_winner,
      public.compute_player_points(
        v_session.scoring_preset,
        v_session.scoring_config,
        v_session.margin_bonus_enabled,
        v_is_winner,
        coalesce((v_player ->> 'margin_bonus_earned')::boolean, false) and v_is_winner
      )
    );
  end loop;

  return v_match_id;
end;
$body$;

create or replace function public.assign_competition_round(p_round_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_players uuid[];
  v_courts uuid[];
  v_court_idx int := 1;
  v_batch uuid[];
  v_shuffled uuid[];
  v_court_id uuid;
  v_i int;
begin
  delete from public.competition_round_players where round_id = p_round_id;

  select coalesce(array_agg(sp.profile_id order by random()), '{}')
  into v_players
  from public.session_players sp
  where sp.session_id = p_session_id;

  select coalesce(array_agg(c.id order by c.sort_order), '{}')
  into v_courts
  from public.courts c
  where c.is_active;

  if coalesce(array_length(v_courts, 1), 0) = 0 then
    raise exception 'No active courts';
  end if;

  while coalesce(array_length(v_players, 1), 0) >= 4 loop
    v_batch := v_players[1:4];
    v_players := v_players[5:coalesce(array_length(v_players, 1), 0)];

    select coalesce(array_agg(x order by random()), '{}')
    into v_shuffled
    from unnest(v_batch) as x;

    v_court_id := v_courts[v_court_idx];
    v_court_idx := v_court_idx + 1;
    if v_court_idx > coalesce(array_length(v_courts, 1), 0) then
      v_court_idx := 1;
    end if;

    for v_i in 1..2 loop
      insert into public.competition_round_players (round_id, court_id, profile_id, team)
      values (p_round_id, v_court_id, v_shuffled[v_i], 'a');
    end loop;
    for v_i in 3..4 loop
      insert into public.competition_round_players (round_id, court_id, profile_id, team)
      values (p_round_id, v_court_id, v_shuffled[v_i], 'b');
    end loop;
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
  v_duration_min int;
  v_total_rounds int;
  v_round_id uuid;
  v_i int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

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
  if v_session.ends_at <= v_session.starts_at then
    raise exception 'Invalid time range';
  end if;

  if (select count(*) from public.session_players where session_id = p_session_id) < 4 then
    raise exception 'Need at least 4 players';
  end if;

  v_duration_min := greatest(15, (extract(epoch from (v_session.ends_at - v_session.starts_at)) / 60)::int);
  v_total_rounds := greatest(1, v_duration_min / 15);

  delete from public.competition_rounds where session_id = p_session_id;

  for v_i in 1..v_total_rounds loop
    insert into public.competition_rounds (
      session_id, round_number, is_final, starts_at, ends_at, status
    ) values (
      p_session_id,
      v_i,
      v_i = v_total_rounds,
      v_session.starts_at + ((v_i - 1) * interval '15 minutes'),
      v_session.starts_at + (v_i * interval '15 minutes'),
      case when v_i = 1 then 'active' else 'pending' end
    )
    returning id into v_round_id;

    if v_i = 1 then
      perform public.assign_competition_round(v_round_id, p_session_id);
    end if;
  end loop;

  update public.game_sessions
  set status = 'locked', competition_started_at = now()
  where id = p_session_id;
end;
$body$;

create or replace function public.advance_competition_round(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_current public.competition_rounds%rowtype;
  v_next public.competition_rounds%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_current
  from public.competition_rounds
  where session_id = p_session_id and status = 'active'
  order by round_number
  limit 1;

  if not found then
    raise exception 'No active round';
  end if;

  update public.competition_rounds
  set status = 'complete'
  where id = v_current.id;

  select * into v_next
  from public.competition_rounds
  where session_id = p_session_id and round_number = v_current.round_number + 1;

  if not found then
    return;
  end if;

  perform public.assign_competition_round(v_next.id, p_session_id);

  update public.competition_rounds
  set status = 'active'
  where id = v_next.id;
end;
$body$;

grant execute on function public.start_competition(uuid) to authenticated;
grant execute on function public.advance_competition_round(uuid) to authenticated;
grant execute on function public.assign_competition_round(uuid, uuid) to authenticated;
