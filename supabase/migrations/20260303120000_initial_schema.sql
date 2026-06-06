-- SuccessPadel initial schema

create extension if not exists "pgcrypto";

-- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  line_user_id text unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index profiles_line_user_id_idx on public.profiles (line_user_id) where line_user_id is not null;

-- seasons
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index seasons_one_active_idx on public.seasons (is_active) where is_active = true;

-- game sessions
create type public.session_status as enum ('draft', 'open', 'locked');
create type public.partnership_mode as enum ('rotating', 'fixed_pairs', 'americano');
create type public.scoring_preset as enum ('standard', 'participation', 'winner_takes_all', 'custom');
create type public.who_can_log as enum ('admin_only', 'roster_members', 'any_member');

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  title text not null,
  week_number int,
  starts_on date not null,
  ends_on date not null,
  status public.session_status not null default 'draft',
  partnership_mode public.partnership_mode not null default 'rotating',
  scoring_preset public.scoring_preset not null default 'standard',
  scoring_config jsonb not null default '{}'::jsonb,
  who_can_log_matches public.who_can_log not null default 'roster_members',
  margin_bonus_enabled boolean not null default true,
  max_players int,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index game_sessions_season_id_idx on public.game_sessions (season_id);
create index game_sessions_status_idx on public.game_sessions (status);

-- session roster
create table public.session_players (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (session_id, profile_id)
);

-- fixed pairs
create table public.session_pairs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  pair_label text,
  player_a_id uuid not null references public.profiles (id) on delete cascade,
  player_b_id uuid not null references public.profiles (id) on delete cascade,
  check (player_a_id <> player_b_id)
);

create index session_pairs_session_id_idx on public.session_pairs (session_id);

-- matches
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  played_at timestamptz not null default now(),
  score_summary text not null default '',
  notes text,
  round_number int,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index matches_session_id_idx on public.matches (session_id);

create type public.match_team as enum ('a', 'b');

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  team public.match_team not null,
  is_winner boolean not null,
  points_earned int not null default 0,
  primary key (match_id, profile_id)
);

-- helpers
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, line_user_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Player'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'line_user_id'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.game_sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.session_pairs enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());

create policy seasons_select on public.seasons for select to authenticated using (true);
create policy seasons_admin on public.seasons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy game_sessions_select on public.game_sessions for select to authenticated using (true);
create policy game_sessions_admin on public.game_sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy session_players_select on public.session_players for select to authenticated using (true);
create policy session_players_admin on public.session_players for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy session_pairs_select on public.session_pairs for select to authenticated using (true);
create policy session_pairs_admin on public.session_pairs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy matches_select on public.matches for select to authenticated using (true);
create policy matches_insert on public.matches for insert to authenticated with check (
  public.is_admin()
  or exists (
    select 1 from public.game_sessions gs
    where gs.id = session_id
      and gs.status = 'open'
      and (
        gs.who_can_log_matches = 'any_member'
        or (gs.who_can_log_matches = 'roster_members' and exists (
          select 1 from public.session_players sp
          where sp.session_id = gs.id and sp.profile_id = auth.uid()
        ))
      )
  )
);
create policy matches_admin on public.matches for update to authenticated using (public.is_admin() or created_by = auth.uid());
create policy matches_delete on public.matches for delete to authenticated using (public.is_admin());

create policy match_players_select on public.match_players for select to authenticated using (true);
create policy match_players_insert on public.match_players for insert to authenticated with check (
  exists (select 1 from public.matches m where m.id = match_id)
);

-- compute points for one player in a match
create or replace function public.compute_player_points(
  p_preset public.scoring_preset,
  p_config jsonb,
  p_margin_bonus boolean,
  p_is_winner boolean,
  p_margin_bonus_earned boolean
)
returns int
language plpgsql
immutable
as $$
declare
  win_pts int := 3;
  loss_pts int := 1;
  bonus int := 0;
begin
  if p_preset = 'participation' then
    return 1;
  elsif p_preset = 'winner_takes_all' then
    return case when p_is_winner then 4 else 0 end;
  elsif p_preset = 'custom' then
    win_pts := coalesce((p_config ->> 'win_points')::int, 3);
    loss_pts := coalesce((p_config ->> 'loss_points')::int, 1);
  end if;

  if p_is_winner then
  bonus := case when p_margin_bonus and p_margin_bonus_earned then 1 else 0 end;
    return win_pts + bonus;
  end if;
  return loss_pts;
end;
$$;

-- record_match RPC
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
as $$
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
  if v_session.status <> 'open' then
    raise exception 'Session is not open';
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
    v_is_winner := (v_player ->> 'is_winner')::boolean;
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
$$;

grant execute on function public.record_match(uuid, text, jsonb, text, int) to authenticated;

-- leaderboard RPC
create or replace function public.get_leaderboard(p_season_id uuid default null)
returns table (
  rank bigint,
  profile_id uuid,
  display_name text,
  avatar_url text,
  season_points bigint,
  level text,
  wins bigint,
  losses bigint,
  matches_played bigint,
  points_this_week bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with active_season as (
    select coalesce(
      p_season_id,
      (select s.id from public.seasons s where s.is_active limit 1)
    ) as id
  ),
  season_matches as (
    select mp.profile_id, mp.is_winner, mp.points_earned, m.session_id, gs.starts_on
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    join public.game_sessions gs on gs.id = m.session_id
    join active_season a on gs.season_id = a.id
  ),
  agg as (
    select
      sm.profile_id,
      sum(sm.points_earned)::bigint as season_points,
      count(*) filter (where sm.is_winner)::bigint as wins,
      count(*) filter (where not sm.is_winner)::bigint as losses,
      count(*)::bigint as matches_played,
      coalesce(sum(sm.points_earned) filter (
        where sm.starts_on >= date_trunc('week', current_date)::date
      ), 0)::bigint as points_this_week
    from season_matches sm
    group by sm.profile_id
  ),
  ranked as (
    select
      row_number() over (order by coalesce(a.season_points, 0) desc, p.display_name)::bigint as rank,
      p.id as profile_id,
      p.display_name,
      p.avatar_url,
      coalesce(a.season_points, 0)::bigint as season_points,
      case
        when coalesce(a.season_points, 0) >= 100 then 'Elite'
        when coalesce(a.season_points, 0) >= 50 then 'Advanced'
        when coalesce(a.season_points, 0) >= 20 then 'Intermediate'
        else 'Beginner'
      end as level,
      coalesce(a.wins, 0)::bigint as wins,
      coalesce(a.losses, 0)::bigint as losses,
      coalesce(a.matches_played, 0)::bigint as matches_played,
      coalesce(a.points_this_week, 0)::bigint as points_this_week
    from public.profiles p
    left join agg a on a.profile_id = p.id
  )
  select * from ranked
  order by rank;
$$;

grant execute on function public.get_leaderboard(uuid) to authenticated;

-- seed default season when empty
insert into public.seasons (name, starts_on, is_active)
select '2026 Club Season', current_date, true
where not exists (select 1 from public.seasons);
