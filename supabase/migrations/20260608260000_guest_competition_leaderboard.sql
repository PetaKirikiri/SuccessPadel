-- Guest names on competition rosters have no profile_id; still earn Americano points.

alter table public.match_players
  drop constraint if exists match_players_pkey;

alter table public.match_players
  add column if not exists id uuid default gen_random_uuid();

alter table public.match_players
  add column if not exists roster_entry_id uuid references public.session_players (id) on delete cascade;

alter table public.match_players
  alter column profile_id drop not null;

update public.match_players set id = gen_random_uuid() where id is null;

alter table public.match_players
  alter column id set not null;

alter table public.match_players
  add constraint match_players_pkey primary key (id);

alter table public.match_players
  add constraint match_players_has_player
  check (profile_id is not null or roster_entry_id is not null);

create unique index if not exists match_players_match_profile_uidx
  on public.match_players (match_id, profile_id)
  where profile_id is not null;

create unique index if not exists match_players_match_roster_uidx
  on public.match_players (match_id, roster_entry_id)
  where roster_entry_id is not null;

create or replace function public.get_competition_leaderboard(p_session_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  total_points bigint,
  games bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(mp.profile_id, mp.roster_entry_id) as profile_id,
    coalesce(p.display_name, sp.guest_name, 'Player') as display_name,
    coalesce(sum(mp.points_earned), 0)::bigint as total_points,
    count(*)::bigint as games
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  left join public.profiles p on p.id = mp.profile_id
  left join public.session_players sp on sp.id = mp.roster_entry_id
  where m.session_id = p_session_id
  group by coalesce(mp.profile_id, mp.roster_entry_id), coalesce(p.display_name, sp.guest_name, 'Player')
  order by sum(mp.points_earned) desc, coalesce(p.display_name, sp.guest_name, 'Player');
$$;

grant execute on function public.get_competition_leaderboard(uuid) to anon, authenticated;

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
    if v_session.partnership_mode = 'americano' then
      if v_player.profile_id is not null then
        insert into public.match_players (match_id, profile_id, team, is_winner, points_earned)
        values (
          v_match_id,
          v_player.profile_id,
          v_player.team,
          (v_player.team = 'a' and v_pts_a > v_pts_b) or (v_player.team = 'b' and v_pts_b > v_pts_a),
          case when v_player.team = 'a' then v_pts_a else v_pts_b end
        );
      else
        insert into public.match_players (match_id, roster_entry_id, team, is_winner, points_earned)
        values (
          v_match_id,
          v_player.roster_id,
          v_player.team,
          (v_player.team = 'a' and v_pts_a > v_pts_b) or (v_player.team = 'b' and v_pts_b > v_pts_a),
          case when v_player.team = 'a' then v_pts_a else v_pts_b end
        );
      end if;
    elsif v_player.profile_id is not null then
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
    else
      insert into public.match_players (match_id, roster_entry_id, team, is_winner, points_earned)
      values (
        v_match_id,
        v_player.roster_id,
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

grant execute on function public.record_competition_match(uuid, uuid, text, public.match_team, boolean, int, int) to anon, authenticated;

-- Backfill guest points for matches that were saved before this fix.
insert into public.match_players (match_id, roster_entry_id, team, is_winner, points_earned)
select
  m.id,
  sp.id,
  crp.team,
  (crp.team = 'a' and split_part(m.score_summary, '-', 1)::int > split_part(m.score_summary, '-', 2)::int)
    or (crp.team = 'b' and split_part(m.score_summary, '-', 2)::int > split_part(m.score_summary, '-', 1)::int),
  case
    when crp.team = 'a' then split_part(m.score_summary, '-', 1)::int
    else split_part(m.score_summary, '-', 2)::int
  end
from public.matches m
join public.game_sessions gs on gs.id = m.session_id
join public.competition_round_players crp
  on crp.round_id = m.competition_round_id and crp.court_id = m.court_id
join public.session_players sp on sp.id = crp.roster_entry_id
where m.competition_round_id is not null
  and gs.partnership_mode = 'americano'
  and sp.profile_id is null
  and m.score_summary ~ '^[0-9]+-[0-9]+$'
  and not exists (
    select 1 from public.match_players mp
    where mp.match_id = m.id and mp.roster_entry_id = sp.id
  );
