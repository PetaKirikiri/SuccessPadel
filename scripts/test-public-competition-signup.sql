-- Run after the migration inside a transaction; always roll back the fixture.
do $$
declare
  sid uuid:=gen_random_uuid();
  rid uuid;
  pid uuid;
  changes jsonb;
begin
  insert into public.game_sessions(id,title,starts_on,ends_on,status,max_players,schedule_game_count,schedule_game_minutes,schedule_break_minutes,scoring_config)
    values(sid,'Public signup rollback test',current_date+7,current_date+7,'open',16,7,13,4,'{"competition_player_mode":"duos","americano_games":7,"game_minutes":13,"break_minutes":4}');
  perform public.public_competition_signup(sid,'[{"slot":0,"name":"Guest A"}]');
  select id into rid from public.session_players where session_id=sid and rank_order=0;
  select id into pid from public.session_pairs where session_id=sid;
  if rid is null or pid is null then raise exception 'Missing guest or pair';end if;
  perform public.public_competition_signup(sid,'[{"slot":1,"name":"Guest B"}]');
  if (select count(*) from public.session_pairs where session_id=sid)<>1 then raise exception 'Pair duplicated';end if;
  changes:=jsonb_build_array(jsonb_build_object('slot',0,'name','Renamed','expected_id',rid,'expected_guest_name','Guest A'));
  perform public.public_competition_signup(sid,changes);
  begin
    perform public.public_competition_signup(sid,changes);
    raise exception 'Stale write accepted';
  exception when others then
    if sqlerrm not like 'This slot changed%' then raise;end if;
  end;
  perform public.public_competition_signup(sid,jsonb_build_array(jsonb_build_object('slot',0,'name','','expected_id',rid,'expected_guest_name','Renamed')));
  perform public.public_competition_signup(sid,'[{"slot":0,"name":"Replacement"}]');
  if not exists(select 1 from public.session_players where session_id=sid and id=rid and guest_name='Replacement') then raise exception 'Slot ID changed';end if;
  if not exists(select 1 from public.session_pairs where id=pid and roster_a_id=rid and roster_b_id is not null) then raise exception 'Pair damaged';end if;
  if (select count(*) from public.competition_signup_history where session_id=sid)<>5 then raise exception 'Missing history';end if;
  begin
    perform public.public_competition_signup(sid,'[{"slot":16,"name":"Outside capacity"}]');
    raise exception 'Capacity bypass';
  exception when others then
    if sqlerrm<>'Invalid name or slot' then raise;end if;
  end;
  update public.game_sessions set competition_started_at=now() where id=sid;
  begin
    perform public.public_competition_signup(sid,'[{"slot":2,"name":"Too late"}]');
    raise exception 'Started game modified';
  exception when others then
    if sqlerrm<>'Registration is closed' then raise;end if;
  end;
  if has_function_privilege('anon','public.public_competition_signup(uuid,jsonb)','EXECUTE')
     or has_table_privilege('anon','public.competition_signup_history','SELECT') then raise exception 'Public privilege leak';end if;
end $$;
