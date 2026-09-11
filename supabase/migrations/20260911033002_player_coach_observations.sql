-- Staff membership is managed through trusted database administration only.
-- Do not trust profiles.is_admin on each request: legacy profile writes expose it.
create table public.coach_feedback_staff (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.coach_feedback_staff enable row level security;
revoke all on public.coach_feedback_staff from public, anon, authenticated;
grant select on public.coach_feedback_staff to authenticated;
create policy coach_staff_self on public.coach_feedback_staff for select to authenticated
  using (profile_id = (select auth.uid()));
-- Bootstrap the currently recognised admins once, not a dynamic privilege grant.
insert into public.coach_feedback_staff(profile_id)
select p.id from public.profiles p join auth.users u on u.id=p.id where p.is_admin is true;

create function public.can_record_coach_feedback() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.coach_feedback_staff where profile_id=(select auth.uid()));
$$;
revoke all on function public.can_record_coach_feedback() from public, anon;
grant execute on function public.can_record_coach_feedback() to authenticated;

create table public.player_coach_observations (
  id uuid primary key,
  player_id uuid not null references public.padel_players(id),
  coach_id uuid not null references public.profiles(id),
  competition_id uuid references public.game_sessions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'processing' check(status in ('processing','complete','error')),
  audio_sha256 text not null,
  audio_seconds integer not null check(audio_seconds between 1 and 120),
  transcript text check(length(transcript)<=16000),
  feedback jsonb,
  model text,
  transcription_model text not null default 'whisper-1',
  usage jsonb,
  error_code text,
  check(status <> 'complete' or (transcript is not null and feedback is not null))
);
create index coach_observations_player_date on public.player_coach_observations(player_id,created_at desc);
create index coach_observations_coach_date on public.player_coach_observations(coach_id,created_at desc);
create index coach_observations_competition on public.player_coach_observations(competition_id);
alter table public.player_coach_observations enable row level security;
revoke all on public.player_coach_observations from public, anon, authenticated;
grant select,insert on public.player_coach_observations to authenticated;
grant update(status,updated_at,transcript,feedback,model,usage,error_code) on public.player_coach_observations to authenticated;
create policy coach_observations_read on public.player_coach_observations for select to authenticated
using ((select public.can_record_coach_feedback()) or
  (status='complete' and exists(select 1 from public.padel_players p where p.id=player_id and p.profile_id=(select auth.uid()))));
create policy coach_observations_insert on public.player_coach_observations for insert to authenticated
with check (coach_id=(select auth.uid()) and (select public.can_record_coach_feedback()));
create policy coach_observations_update on public.player_coach_observations for update to authenticated
using(coach_id=(select auth.uid()) and (select public.can_record_coach_feedback()))
with check(coach_id=(select auth.uid()) and (select public.can_record_coach_feedback()));
notify pgrst, 'reload schema';
