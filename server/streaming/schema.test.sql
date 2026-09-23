-- Run ONLY against a disposable PostgreSQL database. Minimal fixtures model the existing contract.
\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.profiles(id uuid primary key);
create table public.game_sessions(id uuid primary key);
create table public.courts(id uuid primary key);
create table public.competition_rounds(id uuid primary key);
create table public.matches(id uuid primary key, competition_round_id uuid, court_id uuid);
create function public.can_view_game_session(uuid) returns boolean language sql as $$ select $1::text = current_setting('test.session',true) $$;
\ir ../../supabase/migrations/20260910035614_match_live_streaming.sql
insert into profiles values ('10000000-0000-0000-0000-000000000001');
insert into game_sessions values ('20000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002');
insert into courts values ('30000000-0000-0000-0000-000000000001'),('30000000-0000-0000-0000-000000000002');
insert into competition_rounds values ('40000000-0000-0000-0000-000000000001');
insert into match_streams(id,session_id,round_id,court_id,owner_id,slot,state,title,lease_until)
values('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'live','Court',now()+interval '1 minute');
do $$ begin
  begin
    insert into match_streams select '50000000-0000-0000-0000-000000000002',session_id,round_id,court_id,owner_id,2,state,title,broadcast_id,youtube_stream_id,lease_until,live_at,ended_at,error,created_at from match_streams;
    raise exception 'Duplicate court was allowed';
  exception when unique_violation then null; end;
  begin
    insert into match_streams select '50000000-0000-0000-0000-000000000002',session_id,round_id,'30000000-0000-0000-0000-000000000002',owner_id,slot,state,title,broadcast_id,youtube_stream_id,lease_until,live_at,ended_at,error,created_at from match_streams;
    raise exception 'Duplicate worker slot was allowed';
  exception when unique_violation then null; end;
end $$;
insert into match_recordings(id,session_id,round_id,court_id,youtube_video_id,state)
select id,session_id,round_id,court_id,'video','ready' from match_streams;
set local role authenticated;
select set_config('test.session','20000000-0000-0000-0000-000000000002',true);
do $$ begin if (select count(*) from match_recordings) <> 0 then raise exception 'Other event recording leaked'; end if; end $$;
select set_config('test.session','20000000-0000-0000-0000-000000000001',true);
do $$ begin
  if (select count(*) from match_recordings) <> 1 then raise exception 'Authorized recording unavailable'; end if;
  begin perform * from match_streams; raise exception 'Private controller rows leaked'; exception when insufficient_privilege then null; end;
  begin delete from match_recordings; raise exception 'Client recording mutation allowed'; exception when insufficient_privilege then null; end;
  begin perform reconcile_match_recording_links(); raise exception 'Client called reconciliation'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform * from match_recordings; raise exception 'Anonymous recording access allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into matches values('60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
-- Existing Supabase service_role has access to matches.
grant select on matches to service_role;
set local role service_role;
select reconcile_match_recording_links();
do $$ begin if (select match_id from match_recordings) is null then raise exception 'Late score record did not link'; end if; end $$;
rollback;
\echo 'Streaming schema, exclusivity, RLS, and late-score linkage checks passed.'
