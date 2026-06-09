-- Persist friendly gesture-pad match logs (scores, stats, gestures).

create table public.friendly_match_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  friendly_session_id uuid not null references public.friendly_sessions(id) on delete cascade,
  court_setup_key text not null unique,
  game_number int,
  court_label text,
  match_started_at timestamptz not null,
  match_ended_at timestamptz not null,
  final_score jsonb not null,
  winner text not null check (winner in ('a', 'b')),
  player_stats jsonb not null default '[]'::jsonb,
  point_events jsonb not null default '[]'::jsonb,
  gestures jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade
);

create index friendly_match_logs_session_idx
  on public.friendly_match_logs (friendly_session_id, match_ended_at desc);

alter table public.friendly_match_logs enable row level security;

create policy friendly_match_logs_select on public.friendly_match_logs
  for select to authenticated
  using (
    exists (
      select 1
      from public.friendly_sessions fs
      where fs.id = friendly_session_id
        and (fs.visibility = 'public' or fs.created_by = (select auth.uid()))
    )
  );

grant select on public.friendly_match_logs to authenticated;

create or replace function public.save_friendly_match_log(
  p_friendly_session_id uuid,
  p_court_setup_key text,
  p_game_number int default null,
  p_court_label text default null,
  p_match_started_at timestamptz,
  p_match_ended_at timestamptz,
  p_final_score jsonb,
  p_winner text,
  p_player_stats jsonb default '[]'::jsonb,
  p_point_events jsonb default '[]'::jsonb,
  p_gestures jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_id uuid;
  v_session public.friendly_sessions%rowtype;
  v_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_winner not in ('a', 'b') then
    raise exception 'Invalid winner';
  end if;

  select * into v_session
  from public.friendly_sessions
  where id = p_friendly_session_id;

  if not found then
    raise exception 'Friendly session not found';
  end if;

  select coalesce(is_admin, false) into v_admin
  from public.profiles
  where id = auth.uid();

  if not v_admin and v_session.created_by <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  insert into public.friendly_match_logs (
    friendly_session_id,
    court_setup_key,
    game_number,
    court_label,
    match_started_at,
    match_ended_at,
    final_score,
    winner,
    player_stats,
    point_events,
    gestures,
    created_by
  )
  values (
    p_friendly_session_id,
    p_court_setup_key,
    p_game_number,
    p_court_label,
    p_match_started_at,
    p_match_ended_at,
    p_final_score,
    p_winner,
    coalesce(p_player_stats, '[]'::jsonb),
    coalesce(p_point_events, '[]'::jsonb),
    coalesce(p_gestures, '[]'::jsonb),
    auth.uid()
  )
  on conflict (court_setup_key) do update
  set
    match_started_at = excluded.match_started_at,
    match_ended_at = excluded.match_ended_at,
    final_score = excluded.final_score,
    winner = excluded.winner,
    player_stats = excluded.player_stats,
    point_events = excluded.point_events,
    gestures = excluded.gestures
  returning id into v_id;

  return v_id;
end;
$body$;

grant execute on function public.save_friendly_match_log(
  uuid, text, int, text, timestamptz, timestamptz, jsonb, text, jsonb, jsonb, jsonb
) to authenticated;
