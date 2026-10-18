-- Disposable fixture: caller must wrap this file in BEGIN / ROLLBACK.
do $$
declare
  sid uuid:=gen_random_uuid(); member uuid; guest uuid; rid uuid; pair uuid;
begin
  select d.id into member from public.public_member_directory d join public.profiles p on p.id=d.id limit 1;
  select d.id into guest from public.public_member_directory d join public.padel_players p on p.id=d.id where p.profile_id is null limit 1;
  if member is null or guest is null then raise exception 'Missing directory fixtures'; end if;
  insert into public.game_sessions(id,title,starts_on,ends_on,status,max_players,schedule_game_count,schedule_game_minutes,schedule_break_minutes,scoring_config)
    values(sid,'Member signup rollback test',current_date+7,current_date+7,'open',16,7,13,4,'{"competition_player_mode":"duos","americano_games":7,"game_minutes":13,"break_minutes":4}');
  perform public.public_competition_member_signup(sid,jsonb_build_array(jsonb_build_object('slot',0,'name','not canonical','member_id',member)));
  select id into rid from public.session_players where session_id=sid and rank_order=0 and profile_id=member and guest_name is null;
  select id into pair from public.session_pairs where session_id=sid and roster_a_id=rid and player_a_id=member;
  if rid is null or pair is null then raise exception 'Profile or pair link missing'; end if;
  begin
    perform public.public_competition_member_signup(sid,jsonb_build_array(jsonb_build_object('slot',1,'name','duplicate','member_id',member)));
    raise exception 'Duplicate accepted';
  exception when others then if sqlerrm<>'This member already has a slot' then raise; end if; end;
  perform public.public_competition_member_signup(sid,jsonb_build_array(jsonb_build_object('slot',1,'name','guest member','member_id',guest)));
  if not exists(select 1 from public.session_players where session_id=sid and rank_order=1 and padel_player_id=guest and guest_name is not null) then raise exception 'Player identity missing'; end if;
  perform public.public_competition_member_signup(sid,jsonb_build_array(jsonb_build_object('slot',0,'name','','expected_id',rid,'expected_profile_id',member)));
  perform public.public_competition_member_signup(sid,'[{"slot":0,"name":"New visitor"}]');
  if not exists(select 1 from public.session_players where session_id=sid and id=rid and guest_name='New visitor') then raise exception 'Slot identity changed'; end if;
  if not exists(select 1 from public.session_pairs where id=pair and roster_a_id=rid and roster_b_id is not null) then raise exception 'Pair changed'; end if;
  begin
    perform public.public_competition_member_signup(sid,jsonb_build_array(jsonb_build_object('slot',2,'name','invalid','member_id',gen_random_uuid())));
    raise exception 'Unknown member accepted';
  exception when others then if sqlerrm<>'Member is unavailable' then raise; end if; end;
  if has_function_privilege('anon','public.public_competition_member_signup(uuid,jsonb)','EXECUTE') then raise exception 'Public execution granted'; end if;
end $$;
