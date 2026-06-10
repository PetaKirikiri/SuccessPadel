-- Unified gesture-pad game logs (lean JSON: coords, shot types, points, stats).

create table public.match_gesture_logs (
  court_setup_key text primary key,
  friendly_session_id uuid references public.friendly_sessions (id) on delete set null,
  competition_id text,
  game_number text,
  court_id text,
  match_started_at timestamptz not null,
  match_ended_at timestamptz,
  final_score jsonb,
  winner text check (winner is null or winner in ('a', 'b')),
  player_stats jsonb not null default '[]'::jsonb,
  point_events jsonb not null default '[]'::jsonb,
  gestures jsonb not null default '[]'::jsonb,
  roster jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index match_gesture_logs_friendly_idx
  on public.match_gesture_logs (friendly_session_id, updated_at desc);

create index match_gesture_logs_competition_idx
  on public.match_gesture_logs (competition_id, game_number, updated_at desc);

alter table public.match_gesture_logs enable row level security;

create policy match_gesture_logs_select on public.match_gesture_logs
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or coalesce(
      (select is_admin from public.profiles where id = (select auth.uid())),
      false
    )
    or (
      friendly_session_id is not null
      and exists (
        select 1
        from public.friendly_sessions fs
        where fs.id = friendly_session_id
          and (fs.visibility = 'public' or fs.created_by = (select auth.uid()))
      )
    )
  );

grant select on public.match_gesture_logs to authenticated;

create or replace function public.upsert_match_gesture_log(
  p_court_setup_key text,
  p_match_started_at timestamptz,
  p_friendly_session_id uuid default null,
  p_competition_id text default null,
  p_game_number text default null,
  p_court_id text default null,
  p_match_ended_at timestamptz default null,
  p_final_score jsonb default null,
  p_winner text default null,
  p_player_stats jsonb default '[]'::jsonb,
  p_point_events jsonb default '[]'::jsonb,
  p_gestures jsonb default '[]'::jsonb,
  p_roster jsonb default '[]'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_admin boolean;
  v_session public.friendly_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_winner is not null and p_winner not in ('a', 'b') then
    raise exception 'Invalid winner';
  end if;

  select coalesce(is_admin, false) into v_admin
  from public.profiles
  where id = auth.uid();

  if not v_admin then
    raise exception 'Admin only';
  end if;

  if p_friendly_session_id is not null then
    select * into v_session
    from public.friendly_sessions
    where id = p_friendly_session_id;

    if not found then
      raise exception 'Friendly session not found';
    end if;
  end if;

  insert into public.match_gesture_logs (
    court_setup_key,
    friendly_session_id,
    competition_id,
    game_number,
    court_id,
    match_started_at,
    match_ended_at,
    final_score,
    winner,
    player_stats,
    point_events,
    gestures,
    roster,
    created_by,
    updated_at
  )
  values (
    p_court_setup_key,
    p_friendly_session_id,
    p_competition_id,
    p_game_number,
    p_court_id,
    p_match_started_at,
    p_match_ended_at,
    p_final_score,
    p_winner,
    coalesce(p_player_stats, '[]'::jsonb),
    coalesce(p_point_events, '[]'::jsonb),
    coalesce(p_gestures, '[]'::jsonb),
    coalesce(p_roster, '[]'::jsonb),
    auth.uid(),
    now()
  )
  on conflict (court_setup_key) do update
  set
    friendly_session_id = excluded.friendly_session_id,
    competition_id = excluded.competition_id,
    game_number = excluded.game_number,
    court_id = excluded.court_id,
    match_started_at = excluded.match_started_at,
    match_ended_at = excluded.match_ended_at,
    final_score = excluded.final_score,
    winner = excluded.winner,
    player_stats = excluded.player_stats,
    point_events = excluded.point_events,
    gestures = excluded.gestures,
    roster = excluded.roster,
    updated_at = now();

  return p_court_setup_key;
end;
$body$;

grant execute on function public.upsert_match_gesture_log(
  text, timestamptz, uuid, text, text, text, timestamptz, jsonb, text, jsonb, jsonb, jsonb, jsonb
) to authenticated;
