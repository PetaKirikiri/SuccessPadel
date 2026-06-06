-- Guest emails, roster linking, Americano points, auto-advance rounds.

alter table public.session_players
  add column if not exists guest_email text;

create or replace function public.add_competition_guest(
  p_session_id uuid,
  p_display_name text,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_name text;
  v_email text;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  v_name := btrim(p_display_name);
  if v_name = '' then
    raise exception 'Name required';
  end if;

  v_email := nullif(lower(btrim(p_email)), '');

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

  insert into public.session_players (session_id, guest_name, guest_email)
  values (p_session_id, v_name, v_email)
  returning id into v_id;

  return v_id;
end;
$body$;

drop function if exists public.add_competition_guests(uuid, text[]);

create or replace function public.add_competition_guests(p_guests jsonb, p_session_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_guest jsonb;
  v_name text;
  v_email text;
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

  for v_guest in select * from jsonb_array_elements(coalesce(p_guests, '[]'::jsonb))
  loop
    v_name := btrim(v_guest ->> 'name');
    if v_name = '' then
      continue;
    end if;
    if not public.can_join_session(p_session_id) then
      raise exception 'Competition is full';
    end if;

    v_email := nullif(lower(btrim(v_guest ->> 'email')), '');

    insert into public.session_players (session_id, guest_name, guest_email)
    values (p_session_id, v_name, v_email);

    v_added := v_added + 1;
  end loop;

  return v_added;
end;
$body$;

grant execute on function public.add_competition_guests(jsonb, uuid) to authenticated;

create or replace function public.link_guest_rosters_by_email()
returns int
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_email text;
  v_count int;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null or v_email = '' then
    return 0;
  end if;

  update public.session_players sp
  set profile_id = auth.uid(), guest_name = null, guest_email = null
  where sp.profile_id is null
    and sp.guest_email is not null
    and lower(sp.guest_email) = v_email
    and not exists (
      select 1 from public.session_players x
      where x.session_id = sp.session_id and x.profile_id = auth.uid()
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$body$;

grant execute on function public.link_guest_rosters_by_email() to authenticated;

create or replace function public.can_log_competition_match(p_session_id uuid, p_round_id uuid, p_court_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  if v_session.who_can_log_matches = 'any_member' then
    return true;
  end if;

  if v_session.who_can_log_matches = 'roster_members' and exists (
    select 1 from public.session_players sp
    where sp.session_id = p_session_id and sp.profile_id = auth.uid()
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.competition_round_players crp
    join public.session_players sp on sp.id = crp.roster_entry_id
    where crp.round_id = p_round_id
      and crp.court_id = p_court_id
      and sp.profile_id = auth.uid()
  );
end;
$body$;

create or replace function public.try_auto_advance_competition_round(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_round public.competition_rounds%rowtype;
  v_courts int;
  v_scored int;
begin
  select * into v_round
  from public.competition_rounds
  where session_id = p_session_id and status = 'active'
  order by round_number
  limit 1;

  if not found then
    return;
  end if;

  select count(distinct court_id) into v_courts
  from public.competition_round_players
  where round_id = v_round.id;

  select count(*) into v_scored
  from public.matches
  where competition_round_id = v_round.id;

  if v_courts > 0 and v_scored >= v_courts then
    perform public._advance_competition_round_core(p_session_id);
  end if;
end;
$body$;

create or replace function public._advance_competition_round_core(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_current public.competition_rounds%rowtype;
  v_next public.competition_rounds%rowtype;
begin
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

create or replace function public.advance_competition_round(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  perform public._advance_competition_round_core(p_session_id);
end;
$body$;

create or replace function public.record_competition_match(
  p_round_id uuid,
  p_court_id uuid,
  p_score_summary text,
  p_winner_team public.match_team,
  p_margin_bonus boolean default false,
  p_team_a_points int default null,
  p_team_b_points int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_round public.competition_rounds%rowtype;
  v_session public.game_sessions%rowtype;
  v_match_id uuid;
  v_player record;
  v_score text;
  v_pts_a int;
  v_pts_b int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_round from public.competition_rounds where id = p_round_id;
  if not found then
    raise exception 'Round not found';
  end if;

  select * into v_session from public.game_sessions where id = v_round.session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'locked' then
    raise exception 'Competition is not in progress';
  end if;
  if v_round.status not in ('active', 'complete') then
    raise exception 'Round is not open for scoring';
  end if;

  if not public.can_log_competition_match(v_session.id, p_round_id, p_court_id) then
    raise exception 'Not allowed to log scores';
  end if;

  if (select count(*) from public.competition_round_players
      where round_id = p_round_id and court_id = p_court_id) <> 4 then
    raise exception 'Court must have 4 players';
  end if;

  if v_session.partnership_mode = 'americano' then
    if p_team_a_points is null or p_team_b_points is null then
      raise exception 'Team points required for Americano';
    end if;
    if p_team_a_points < 0 or p_team_b_points < 0 then
      raise exception 'Invalid points';
    end if;
    v_pts_a := p_team_a_points;
    v_pts_b := p_team_b_points;
    v_score := v_pts_a::text || '-' || v_pts_b::text;
  else
    v_score := btrim(p_score_summary);
    if v_score = '' then
      raise exception 'Score required';
    end if;
  end if;

  select id into v_match_id
  from public.matches
  where competition_round_id = p_round_id and court_id = p_court_id;

  if v_match_id is null then
    insert into public.matches (
      session_id, score_summary, round_number, competition_round_id, court_id, created_by
    ) values (
      v_session.id, v_score, v_round.round_number, p_round_id, p_court_id, auth.uid()
    )
    returning id into v_match_id;
  else
    update public.matches
    set score_summary = v_score, created_by = auth.uid(), played_at = now()
    where id = v_match_id;
    delete from public.match_players where match_id = v_match_id;
  end if;

  for v_player in
    select sp.profile_id, crp.team, sp.id as roster_id
    from public.competition_round_players crp
    join public.session_players sp on sp.id = crp.roster_entry_id
    where crp.round_id = p_round_id and crp.court_id = p_court_id
  loop
    if v_player.profile_id is null then
      continue;
    end if;

    if v_session.partnership_mode = 'americano' then
      insert into public.match_players (match_id, profile_id, team, is_winner, points_earned)
      values (
        v_match_id,
        v_player.profile_id,
        v_player.team,
        (v_player.team = 'a' and v_pts_a > v_pts_b) or (v_player.team = 'b' and v_pts_b > v_pts_a),
        case when v_player.team = 'a' then v_pts_a else v_pts_b end
      );
    else
      insert into public.match_players (match_id, profile_id, team, is_winner, points_earned)
      values (
        v_match_id,
        v_player.profile_id,
        v_player.team,
        v_player.team = p_winner_team,
        public.compute_player_points(
          v_session.scoring_preset,
          v_session.scoring_config,
          v_session.margin_bonus_enabled,
          v_player.team = p_winner_team,
          p_margin_bonus and v_player.team = p_winner_team
        )
      );
    end if;
  end loop;

  perform public.try_auto_advance_competition_round(v_session.id);

  return v_match_id;
end;
$body$;

grant execute on function public.try_auto_advance_competition_round(uuid) to authenticated;
grant execute on function public.link_guest_rosters_by_email() to authenticated;
grant execute on function public.record_competition_match(uuid, uuid, text, public.match_team, boolean, int, int) to authenticated;
