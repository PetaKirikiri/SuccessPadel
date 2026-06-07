-- Persistent player identities for guests (and members). Link to profiles later; match history stays put.

create table public.padel_players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  normalized_name text generated always as (lower(btrim(display_name))) stored,
  guest_email text,
  profile_id uuid references public.profiles (id) on delete set null,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint padel_players_member_or_guest check (
    profile_id is not null or btrim(display_name) <> ''
  )
);

create unique index padel_players_profile_uidx
  on public.padel_players (profile_id)
  where profile_id is not null;

create index padel_players_normalized_name_idx on public.padel_players (normalized_name);

alter table public.padel_players enable row level security;

create policy padel_players_select on public.padel_players
  for select to anon, authenticated using (true);

create policy padel_players_admin on public.padel_players
  for all to authenticated using (public.is_admin());

grant select on public.padel_players to anon, authenticated;

alter table public.session_players
  add column if not exists padel_player_id uuid references public.padel_players (id) on delete set null;

alter table public.match_players
  add column if not exists padel_player_id uuid references public.padel_players (id) on delete set null;

alter table public.match_players
  drop constraint if exists match_players_roster_entry_id_fkey;

alter table public.match_players
  add constraint match_players_roster_entry_id_fkey
  foreign key (roster_entry_id) references public.session_players (id) on delete set null;

alter table public.match_players
  drop constraint if exists match_players_has_player;

alter table public.match_players
  add constraint match_players_has_player check (
    profile_id is not null or roster_entry_id is not null or padel_player_id is not null
  );

create or replace function public.find_or_create_padel_player(
  p_display_name text,
  p_guest_email text default null,
  p_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_id uuid;
  v_name text;
  v_email text;
  v_norm text;
begin
  if p_profile_id is not null then
    select id into v_id from public.padel_players where profile_id = p_profile_id;
    if found then
      return v_id;
    end if;
    select display_name into v_name from public.profiles where id = p_profile_id;
    insert into public.padel_players (display_name, profile_id, linked_at)
    values (coalesce(nullif(btrim(v_name), ''), btrim(p_display_name)), p_profile_id, now())
    returning id into v_id;
    return v_id;
  end if;

  v_norm := lower(btrim(p_display_name));
  v_email := nullif(btrim(p_guest_email), '');
  if v_norm = '' then
    raise exception 'Display name required';
  end if;

  select id into v_id
  from public.padel_players
  where profile_id is null
    and normalized_name = v_norm
    and coalesce(guest_email, '') = coalesce(v_email, '')
  order by created_at
  limit 1;

  if found then
    return v_id;
  end if;

  insert into public.padel_players (display_name, guest_email)
  values (btrim(p_display_name), v_email)
  returning id into v_id;

  return v_id;
end;
$body$;

grant execute on function public.find_or_create_padel_player(text, text, uuid) to authenticated;

-- Backfill from existing rosters and match history.
insert into public.padel_players (display_name, guest_email)
select distinct on (lower(btrim(sp.guest_name)), coalesce(sp.guest_email, ''))
  btrim(sp.guest_name),
  sp.guest_email
from public.session_players sp
where sp.guest_name is not null
  and btrim(sp.guest_name) <> ''
order by lower(btrim(sp.guest_name)), coalesce(sp.guest_email, ''), sp.id;

insert into public.padel_players (display_name, profile_id, linked_at)
select p.display_name, p.id, now()
from public.profiles p
where exists (
  select 1 from public.session_players sp where sp.profile_id = p.id
)
and not exists (
  select 1 from public.padel_players pp where pp.profile_id = p.id
);

update public.session_players sp
set padel_player_id = pp.id
from public.padel_players pp
where sp.padel_player_id is null
  and sp.profile_id is not null
  and pp.profile_id = sp.profile_id;

update public.session_players sp
set padel_player_id = pp.id
from public.padel_players pp
where sp.padel_player_id is null
  and sp.guest_name is not null
  and pp.profile_id is null
  and pp.normalized_name = lower(btrim(sp.guest_name))
  and coalesce(pp.guest_email, '') = coalesce(sp.guest_email, '');

update public.match_players mp
set padel_player_id = sp.padel_player_id
from public.session_players sp
where mp.padel_player_id is null
  and mp.roster_entry_id = sp.id
  and sp.padel_player_id is not null;

update public.match_players mp
set padel_player_id = pp.id
from public.padel_players pp
where mp.padel_player_id is null
  and mp.profile_id is not null
  and pp.profile_id = mp.profile_id;

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
  v_padel_id uuid;
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
  select rank_order, guest_name, guest_email, padel_player_id
  from public.session_players
  where session_id = p_session_id
    and guest_name is not null;

  delete from public.session_players
  where session_id = p_session_id
    and guest_name is not null;

  for v_i in 1..coalesce(array_length(p_names, 1), 0) loop
    v_name := btrim(p_names[v_i]);
    if v_name <> '' then
      select og.guest_email, og.padel_player_id
      into v_email, v_padel_id
      from _old_guests og
      where og.rank_order = v_i - 1
        and og.guest_name = v_name
      limit 1;

      if v_padel_id is null then
        v_padel_id := public.find_or_create_padel_player(v_name, v_email, null);
      end if;

      insert into public.session_players (session_id, guest_name, guest_email, rank_order, padel_player_id)
      values (p_session_id, v_name, v_email, v_i - 1, v_padel_id);
    end if;
  end loop;
end;
$body$;

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
    coalesce(mp.profile_id, mp.padel_player_id, mp.roster_entry_id) as profile_id,
    coalesce(p.display_name, pp.display_name, sp.guest_name, 'Player') as display_name,
    coalesce(sum(mp.points_earned), 0)::bigint as total_points,
    count(*)::bigint as games
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  left join public.profiles p on p.id = mp.profile_id
  left join public.padel_players pp on pp.id = mp.padel_player_id
  left join public.session_players sp on sp.id = mp.roster_entry_id
  where m.session_id = p_session_id
  group by
    coalesce(mp.profile_id, mp.padel_player_id, mp.roster_entry_id),
    coalesce(p.display_name, pp.display_name, sp.guest_name, 'Player')
  order by sum(mp.points_earned) desc, coalesce(p.display_name, pp.display_name, sp.guest_name, 'Player');
$$;

create or replace function public.get_public_competition(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when gs.game_kind <> 'competition' then null
    else jsonb_build_object(
      'session', to_jsonb(gs),
      'roster', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', sp.id,
          'profile_id', sp.profile_id,
          'padel_player_id', sp.padel_player_id,
          'guest_name', sp.guest_name,
          'rank_order', sp.rank_order,
          'profiles', case when pr.id is null then null
            else jsonb_build_object('id', pr.id, 'display_name', pr.display_name) end
        ) order by sp.rank_order nulls last, sp.id), '[]'::jsonb)
        from public.session_players sp
        left join public.profiles pr on pr.id = sp.profile_id
        where sp.session_id = gs.id
      ),
      'courts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'name', c.name, 'sort_order', c.sort_order
        ) order by c.sort_order), '[]'::jsonb)
        from public.courts c
        where c.is_active
      ),
      'rounds', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id,
          'session_id', r.session_id,
          'round_number', r.round_number,
          'is_final', r.is_final,
          'starts_at', r.starts_at,
          'ends_at', r.ends_at,
          'status', r.status,
          'competition_round_players', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'court_id', crp.court_id,
              'team', crp.team,
              'roster_entry_id', crp.roster_entry_id,
              'profile_id', crp.profile_id,
              'padel_player_id', sp.padel_player_id,
              'session_players', case when sp.id is null then null
                else jsonb_build_object(
                  'guest_name', sp.guest_name,
                  'profile_id', sp.profile_id,
                  'padel_player_id', sp.padel_player_id,
                  'profiles', case when pr.id is null then null
                    else jsonb_build_object('id', pr.id, 'display_name', pr.display_name) end
                ) end,
              'courts', case when c.id is null then null
                else jsonb_build_object('id', c.id, 'name', c.name) end
            )), '[]'::jsonb)
            from public.competition_round_players crp
            left join public.session_players sp on sp.id = crp.roster_entry_id
            left join public.profiles pr on pr.id = sp.profile_id
            left join public.courts c on c.id = crp.court_id
            where crp.round_id = r.id
          )
        ) order by r.round_number), '[]'::jsonb)
        from public.competition_rounds r
        where r.session_id = gs.id
      ),
      'matches', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'competition_round_id', m.competition_round_id,
          'court_id', m.court_id,
          'score_summary', m.score_summary,
          'played_at', m.played_at,
          'match_players', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'team', mp.team, 'is_winner', mp.is_winner,
              'padel_player_id', mp.padel_player_id
            )), '[]'::jsonb)
            from public.match_players mp
            where mp.match_id = m.id
          )
        )), '[]'::jsonb)
        from public.matches m
        where m.session_id = gs.id and m.competition_round_id is not null
      ),
      'leaderboard', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'profile_id', l.profile_id,
          'display_name', l.display_name,
          'total_points', l.total_points,
          'games', l.games
        )), '[]'::jsonb)
        from public.get_competition_leaderboard(gs.id) l
      )
    )
  end
  from public.game_sessions gs
  where gs.id = p_session_id;
$$;

-- Latest record_competition_match: stamp padel_player_id on every match_players row.
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
  if v_session.status not in ('locked', 'complete') then
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

  insert into public.matches (
    session_id, score_summary, round_number, competition_round_id, court_id, created_by, played_at
  ) values (
    v_session.id, v_score, v_round.round_number, p_round_id, p_court_id, auth.uid(), now()
  )
  on conflict (competition_round_id, court_id)
    where competition_round_id is not null and court_id is not null
  do update set
    score_summary = excluded.score_summary,
    created_by = excluded.created_by,
    played_at = now()
  returning id into v_match_id;

  delete from public.match_players where match_id = v_match_id;

  for v_player in
    select sp.profile_id, crp.team, sp.id as roster_id, sp.padel_player_id
    from public.competition_round_players crp
    join public.session_players sp on sp.id = crp.roster_entry_id
    where crp.round_id = p_round_id and crp.court_id = p_court_id
  loop
    if v_session.partnership_mode = 'americano' then
      if v_player.profile_id is not null then
        insert into public.match_players (match_id, profile_id, padel_player_id, team, is_winner, points_earned)
        values (
          v_match_id,
          v_player.profile_id,
          coalesce(
            v_player.padel_player_id,
            public.find_or_create_padel_player(
              (select display_name from public.profiles where id = v_player.profile_id),
              null,
              v_player.profile_id
            )
          ),
          v_player.team,
          (v_player.team = 'a' and v_pts_a > v_pts_b) or (v_player.team = 'b' and v_pts_b > v_pts_a),
          case when v_player.team = 'a' then v_pts_a else v_pts_b end
        );
      else
        insert into public.match_players (match_id, roster_entry_id, padel_player_id, team, is_winner, points_earned)
        values (
          v_match_id,
          v_player.roster_id,
          coalesce(
            v_player.padel_player_id,
            public.find_or_create_padel_player(
              (select guest_name from public.session_players where id = v_player.roster_id),
              (select guest_email from public.session_players where id = v_player.roster_id),
              null
            )
          ),
          v_player.team,
          (v_player.team = 'a' and v_pts_a > v_pts_b) or (v_player.team = 'b' and v_pts_b > v_pts_a),
          case when v_player.team = 'a' then v_pts_a else v_pts_b end
        );
      end if;
    elsif v_player.profile_id is not null then
      insert into public.match_players (match_id, profile_id, padel_player_id, team, is_winner, points_earned)
      values (
        v_match_id,
        v_player.profile_id,
        coalesce(
          v_player.padel_player_id,
          public.find_or_create_padel_player(
            (select display_name from public.profiles where id = v_player.profile_id),
            null,
            v_player.profile_id
          )
        ),
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
      insert into public.match_players (match_id, roster_entry_id, padel_player_id, team, is_winner, points_earned)
      values (
        v_match_id,
        v_player.roster_id,
        coalesce(
          v_player.padel_player_id,
          public.find_or_create_padel_player(
            (select guest_name from public.session_players where id = v_player.roster_id),
            (select guest_email from public.session_players where id = v_player.roster_id),
            null
          )
        ),
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

  if v_session.status = 'locked' then
    perform public.try_auto_advance_competition_round(v_session.id);
  end if;

  return v_match_id;
end;
$body$;

grant execute on function public.record_competition_match(uuid, uuid, text, public.match_team, boolean, int, int) to anon, authenticated;

-- Link a remembered guest identity to a real profile when they sign up.
create or replace function public.link_padel_player_to_profile(
  p_padel_player_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if not public.is_admin() and auth.uid() is distinct from p_profile_id then
    raise exception 'Not allowed';
  end if;

  update public.padel_players
  set profile_id = p_profile_id,
      linked_at = now(),
      updated_at = now()
  where id = p_padel_player_id
    and profile_id is null;

  if not found then
    raise exception 'Player not found or already linked';
  end if;

  update public.session_players
  set profile_id = p_profile_id,
      padel_player_id = p_padel_player_id
  where padel_player_id = p_padel_player_id
    and profile_id is null;

  update public.match_players
  set profile_id = p_profile_id
  where padel_player_id = p_padel_player_id
    and profile_id is null;
end;
$body$;

grant execute on function public.link_padel_player_to_profile(uuid, uuid) to authenticated;
