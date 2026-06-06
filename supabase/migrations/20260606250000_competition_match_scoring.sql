-- Per-court match scores during competition rounds.

alter table public.matches
  add column if not exists competition_round_id uuid references public.competition_rounds (id) on delete cascade,
  add column if not exists court_id uuid references public.courts (id);

create unique index if not exists matches_comp_round_court_uniq
  on public.matches (competition_round_id, court_id)
  where competition_round_id is not null and court_id is not null;

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
    select 1 from public.competition_round_players crp
    where crp.round_id = p_round_id
      and crp.court_id = p_court_id
      and crp.profile_id = auth.uid()
  );
end;
$body$;

create or replace function public.record_competition_match(
  p_round_id uuid,
  p_court_id uuid,
  p_score_summary text,
  p_winner_team public.match_team,
  p_margin_bonus boolean default false
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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_score := btrim(p_score_summary);
  if v_score = '' then
    raise exception 'Score required';
  end if;

  select * into v_round from public.competition_rounds where id = p_round_id;
  if not found then
    raise exception 'Round not found';
  end if;
  if v_round.status not in ('active', 'complete') then
    raise exception 'Round is not open for scoring';
  end if;

  select * into v_session from public.game_sessions where id = v_round.session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'locked' then
    raise exception 'Competition is not in progress';
  end if;

  if not public.can_log_competition_match(v_session.id, p_round_id, p_court_id) then
    raise exception 'Not allowed to log scores';
  end if;

  if (select count(*) from public.competition_round_players
      where round_id = p_round_id and court_id = p_court_id) <> 4 then
    raise exception 'Court must have 4 players';
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
    select crp.profile_id, crp.team
    from public.competition_round_players crp
    where crp.round_id = p_round_id and crp.court_id = p_court_id
  loop
    if v_player.profile_id is null then
      continue;
    end if;

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
  end loop;

  return v_match_id;
end;
$body$;

grant execute on function public.can_log_competition_match(uuid, uuid, uuid) to authenticated;
grant execute on function public.record_competition_match(uuid, uuid, text, public.match_team, boolean) to authenticated;
