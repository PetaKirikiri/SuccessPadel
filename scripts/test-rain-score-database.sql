-- Execute as a database administrator. All test edits are rolled back.
begin;
set local role anon;
do $$
declare
  s public.rain_mode_scores;
  saved public.rain_mode_scores;
  sid uuid := 'a1ac8c3a-86f7-4936-b49c-829bd6c88953';
  fingerprint text := 'acdca2fd5eeca552f1da8558689f990f91bca9ae22e60ea85215ab1cef5dcdc0';
begin
  if (select count(*) from public.rain_mode_scores where session_id=sid) <> 18 then raise exception 'Missing public score slots'; end if;
  select * into s from public.rain_mode_scores where session_id=sid and game_number=9 and court_slot=2;
  select * into saved from public.save_rain_mode_score(sid,fingerprint,9,2,98,97,s.revision);
  if saved.team_a <> 98 or saved.team_b <> 97 or saved.revision <> s.revision + 1 then raise exception 'Save failed'; end if;
  select * into saved from public.save_rain_mode_score(sid,fingerprint,9,2,98,97,s.revision);
  if saved.revision <> s.revision + 1 then raise exception 'Retry was not idempotent'; end if;
  begin
    perform public.save_rain_mode_score(sid,fingerprint,9,2,96,97,s.revision);
    raise exception 'Stale score overwrote another device';
  exception when serialization_failure then null; end;
  begin
    update public.rain_mode_scores set court_slot=1 where session_id=sid and game_number=9 and court_slot=2;
    raise exception 'Court identity was editable';
  exception when insufficient_privilege then null; end;
  begin
    update public.rain_mode_draws set draw='{}' where session_id=sid;
    raise exception 'Draw was editable';
  exception when insufficient_privilege then null; end;
  begin
    update public.rain_mode_scores set team_a=100 where session_id=sid and game_number=9 and court_slot=2;
    raise exception 'Invalid score accepted';
  exception when check_violation then null; end;
end $$;
set local role authenticated;
do $$ begin
  if (select count(*) from public.rain_mode_scores where session_id='a1ac8c3a-86f7-4936-b49c-829bd6c88953') <> 18 then raise exception 'Signed-in reads failed'; end if;
end $$;
rollback;
