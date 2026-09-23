-- Media control is server-only. Recordings contain no credentials or publisher tokens.
create table public.match_stream_assignments (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  court_id uuid not null references public.courts(id),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  primary key(session_id, court_id, profile_id)
);
create table public.match_streams (
  id uuid primary key,
  session_id uuid not null references public.game_sessions(id),
  round_id uuid not null references public.competition_rounds(id),
  court_id uuid not null references public.courts(id),
  owner_id uuid not null references public.profiles(id),
  slot integer not null check(slot between 1 and 4),
  state text not null check(state in ('preparing','connecting','live','stopping','complete','failed')),
  title text not null,
  broadcast_id text,
  youtube_stream_id text,
  lease_until timestamptz not null,
  live_at timestamptz,
  ended_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create unique index match_streams_one_court on public.match_streams(court_id)
  where state not in ('complete','failed');
create unique index match_streams_one_slot on public.match_streams(slot)
  where state not in ('complete','failed');
create unique index match_streams_one_match on public.match_streams(round_id,court_id)
  where state not in ('complete','failed');
create index match_streams_owner on public.match_streams(owner_id);
create index match_streams_session on public.match_streams(session_id);
create table public.match_recordings (
  id uuid primary key references public.match_streams(id),
  session_id uuid not null references public.game_sessions(id),
  round_id uuid not null references public.competition_rounds(id),
  court_id uuid not null references public.courts(id),
  match_id uuid references public.matches(id) on delete set null,
  youtube_video_id text not null,
  state text not null check(state in ('live','processing','ready','unavailable')),
  created_at timestamptz not null default now()
);
create index match_recordings_match on public.match_recordings(match_id);
create index match_recordings_round_court on public.match_recordings(round_id,court_id);
create index match_stream_assignments_profile on public.match_stream_assignments(profile_id);
alter table public.match_stream_assignments enable row level security;
alter table public.match_streams enable row level security;
alter table public.match_recordings enable row level security;
revoke all on public.match_stream_assignments, public.match_streams, public.match_recordings from anon, authenticated;
grant all on public.match_stream_assignments, public.match_streams, public.match_recordings to service_role;
grant select on public.match_recordings to authenticated;
create policy match_recordings_view on public.match_recordings for select to authenticated
  using (public.can_view_game_session(session_id));
-- No client mutation policies: grants and all state transitions are backend-owned.
-- Worker reconciles match_id by canonical (round_id,court_id), including scores saved later.
create function public.reconcile_match_recording_links() returns void
language sql security invoker set search_path = '' as $$
  update public.match_recordings r set match_id = m.id
  from public.matches m
  where r.match_id is null and m.competition_round_id = r.round_id and m.court_id = r.court_id;
$$;
revoke all on function public.reconcile_match_recording_links() from public, anon, authenticated;
grant execute on function public.reconcile_match_recording_links() to service_role;
