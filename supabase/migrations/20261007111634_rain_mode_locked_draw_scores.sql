-- Rain-mode data is deliberately separate from the already-started competition.
create table public.rain_mode_draws (
  session_id uuid primary key references public.game_sessions(id),
  fingerprint text not null check (length(fingerprint) = 64),
  draw jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.rain_mode_scores (
  session_id uuid not null references public.rain_mode_draws(session_id),
  game_number integer not null check (game_number between 1 and 9),
  court_slot integer not null check (court_slot between 1 and 2),
  team_a integer check (team_a between 0 and 99),
  team_b integer check (team_b between 0 and 99),
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (session_id, game_number, court_slot),
  check ((team_a is null) = (team_b is null))
);

alter table public.rain_mode_draws enable row level security;
alter table public.rain_mode_scores enable row level security;
revoke all on public.rain_mode_draws, public.rain_mode_scores from anon, authenticated;
grant select on public.rain_mode_draws, public.rain_mode_scores to anon, authenticated;
-- Like existing public competition scoring, only score values are writable.
grant update (team_a, team_b) on public.rain_mode_scores to anon, authenticated;

create policy rain_draw_read on public.rain_mode_draws for select to anon, authenticated
  using (public.is_public_competition_session(session_id));
create policy rain_score_read on public.rain_mode_scores for select to anon, authenticated
  using (public.is_public_competition_session(session_id));
create policy rain_score_update on public.rain_mode_scores for update to anon, authenticated
  using (exists (select 1 from public.rain_mode_draws d where d.session_id = rain_mode_scores.session_id and d.active))
  with check (exists (select 1 from public.rain_mode_draws d where d.session_id = rain_mode_scores.session_id and d.active));

create function public.rain_score_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.rain_score_revision() from public;
create trigger rain_score_revision before update on public.rain_mode_scores
for each row execute function public.rain_score_revision();

create function public.save_rain_mode_score(
  p_session_id uuid, p_fingerprint text, p_game_number integer, p_court_slot integer,
  p_team_a integer, p_team_b integer, p_expected_revision integer
) returns public.rain_mode_scores
language plpgsql security invoker set search_path = '' as $$
declare saved public.rain_mode_scores;
begin
  if p_team_a is null or p_team_b is null or p_team_a not between 0 and 99 or p_team_b not between 0 and 99 then
    raise exception 'Scores must be whole numbers between 0 and 99';
  end if;
  if not exists (select 1 from public.rain_mode_draws where session_id = p_session_id and fingerprint = p_fingerprint and active) then
    raise exception 'The saved rain draw does not match this page';
  end if;
  update public.rain_mode_scores set team_a = p_team_a, team_b = p_team_b
    where session_id = p_session_id and game_number = p_game_number and court_slot = p_court_slot
      and revision = p_expected_revision
    returning * into saved;
  if found then return saved; end if;
  select * into saved from public.rain_mode_scores
    where session_id = p_session_id and game_number = p_game_number and court_slot = p_court_slot;
  -- A lost network response may cause a retry of an already-saved score.
  if found and saved.team_a = p_team_a and saved.team_b = p_team_b then return saved; end if;
  raise exception using errcode = '40001', message = 'This score changed on another device. Check the online score before editing again.';
end;
$$;
revoke all on function public.save_rain_mode_score(uuid,text,integer,integer,integer,integer,integer) from public;
grant execute on function public.save_rain_mode_score(uuid,text,integer,integer,integer,integer,integer) to anon, authenticated;
