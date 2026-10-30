begin;
select set_config('test.costume_admin',(select s.profile_id::text from public.coach_feedback_staff s join public.profiles p on p.id=s.profile_id where p.is_admin limit 1),true);
select set_config('test.costume_roster',(select id::text from public.session_players where session_id='882f0946-4cf7-4575-b6b4-982146f02479' and rank_order=0),true);
select set_config('test.costume_subject',(select subject_key from public.halloween_costume_subject(current_setting('test.costume_roster')::uuid)),true);
set local role anon;
do $$ begin
 begin
  perform public.list_halloween_costumes('882f0946-4cf7-4575-b6b4-982146f02479',null);
  raise exception 'Unauthorized read allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.save_halloween_costume('882f0946-4cf7-4575-b6b4-982146f02479',current_setting('test.costume_roster')::uuid,current_setting('test.costume_subject'),'test',0,null);
  raise exception 'Unauthorized write allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.costume_admin'),true);
set local role authenticated;
do $$ declare v jsonb; n int; begin
 select coalesce((item->>'revision')::int,0) into n from jsonb_array_elements(public.list_halloween_costumes('882f0946-4cf7-4575-b6b4-982146f02479')) item where item->>'roster_id'=current_setting('test.costume_roster');
 v:=public.save_halloween_costume('882f0946-4cf7-4575-b6b4-982146f02479',current_setting('test.costume_roster')::uuid,current_setting('test.costume_subject'),'Regression test vampire cape',n);
 assert (v->>'revision')::int=n+1;
 assert v->>'description'='Regression test vampire cape';
 assert exists(select 1 from jsonb_array_elements(public.list_halloween_costumes('882f0946-4cf7-4575-b6b4-982146f02479')) item where item->>'roster_id'=current_setting('test.costume_roster') and (item->>'needs_avatar')::boolean);
 begin
  perform public.save_halloween_costume('882f0946-4cf7-4575-b6b4-982146f02479',current_setting('test.costume_roster')::uuid,current_setting('test.costume_subject'),'stale edit',n);
  raise exception 'Stale overwrite allowed';
 exception when serialization_failure then null; end;
 begin
  perform public.save_halloween_costume('882f0946-4cf7-4575-b6b4-982146f02479',current_setting('test.costume_roster')::uuid,'wrong-player','wrong edit',n+1);
  raise exception 'Wrong player allowed';
 exception when serialization_failure then null; end;
end $$;
reset role;
update public.player_event_costumes set portrait_url='https://example.invalid/test.png',portrait_revision=revision where subject_key=current_setting('test.costume_subject');
set local role authenticated;
do $$ declare n int; begin
 assert not exists(select 1 from jsonb_array_elements(public.list_halloween_costumes('882f0946-4cf7-4575-b6b4-982146f02479')) item where item->>'roster_id'=current_setting('test.costume_roster') and (item->>'needs_avatar')::boolean);
 select (item->>'revision')::int into n from jsonb_array_elements(public.list_halloween_costumes('882f0946-4cf7-4575-b6b4-982146f02479')) item where item->>'roster_id'=current_setting('test.costume_roster');
 perform public.save_halloween_costume('882f0946-4cf7-4575-b6b4-982146f02479',current_setting('test.costume_roster')::uuid,current_setting('test.costume_subject'),'Regression test witch hat',n);
 assert exists(select 1 from jsonb_array_elements(public.list_halloween_costumes('882f0946-4cf7-4575-b6b4-982146f02479')) item where item->>'roster_id'=current_setting('test.costume_roster') and (item->>'needs_avatar')::boolean);
end $$;
rollback;
