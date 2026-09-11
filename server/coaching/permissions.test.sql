begin;
create temporary table coach_test_context as
select (select profile_id from public.coach_feedback_staff limit 1) as coach,
  p.profile_id as player_profile,p.id as player,
  (select id from public.profiles q where q.id<>p.profile_id and not exists(select 1 from public.coach_feedback_staff s where s.profile_id=q.id) limit 1) as outsider,
  gen_random_uuid() as observation
from public.padel_players p where p.profile_id is not null and not exists(select 1 from public.coach_feedback_staff s where s.profile_id=p.profile_id) limit 1;
grant select on coach_test_context to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select coach::text from coach_test_context),true);
do $$ begin
  if not public.can_record_coach_feedback() then raise exception 'staff denied'; end if;
end $$;
insert into public.player_coach_observations(id,player_id,coach_id,audio_sha256,audio_seconds)
select observation,player,coach,'rollback-only-test',10 from coach_test_context;
update public.player_coach_observations set transcript='Rollback-only test',feedback='{"observations":[]}',status='complete'
where id=(select observation from coach_test_context);
do $$ begin
  if (select count(*) from public.player_coach_observations where id=(select observation from coach_test_context))<>1 then raise exception 'staff read failed'; end if;
  begin
    update public.player_coach_observations set player_id=gen_random_uuid() where id=(select observation from coach_test_context);
    raise exception 'identity was mutable';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select player_profile::text from coach_test_context),true);
do $$ begin
  if public.can_record_coach_feedback() then raise exception 'player has staff access'; end if;
  if (select count(*) from public.player_coach_observations where id=(select observation from coach_test_context))<>1 then raise exception 'player cannot read own feedback'; end if;
  begin
    insert into public.player_coach_observations(id,player_id,coach_id,audio_sha256,audio_seconds)
      select gen_random_uuid(),player,player_profile,'forbidden',10 from coach_test_context;
    raise exception 'player insert was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.coach_feedback_staff(profile_id) select player_profile from coach_test_context;
    raise exception 'self-granted coach access';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select outsider::text from coach_test_context),true);
do $$ begin
  if exists(select 1 from public.player_coach_observations where id=(select observation from coach_test_context)) then raise exception 'unrelated player can read feedback'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.player_coach_observations limit 1;
    raise exception 'anonymous access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: staff save/read, player-only read, outsider and anonymous denial, immutable player identity, no self-granted coach access; all test writes rolled back' as result;
