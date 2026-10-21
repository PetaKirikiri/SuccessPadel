-- Run after the public invite reorder migration. All test writes roll back.
begin;

do $$
declare
 sid uuid := gen_random_uuid();
 source_id uuid;
 fixture game_sessions%rowtype;
 expected jsonb; ids uuid[]; original jsonb; after_state jsonb; rejected boolean;
begin
 select id into source_id from game_sessions where game_kind='competition' and partnership_mode='americano' and coalesce(scoring_config->>'competition_player_mode','singles')='singles' and (select count(*) from session_players where session_id=game_sessions.id)>=2 order by created_at desc limit 1;
 if source_id is null then raise exception 'Test needs an existing singles competition as a template'; end if;
 select * into fixture from game_sessions where id=source_id;
 fixture.id:=sid; fixture.starts_on:=(now() at time zone 'Asia/Bangkok')::date;
 fixture.status:='open'; fixture.competition_started_at:=null;
 insert into game_sessions select (fixture).*;
 insert into session_players(id,session_id,rank_order,profile_id,padel_player_id,guest_name,guest_email)
 select gen_random_uuid(),sid,rank_order,profile_id,padel_player_id,guest_name,guest_email from session_players where session_id=source_id;
 select jsonb_agg(to_jsonb(p) order by rank_order,id) into original from session_players p where session_id=sid;
 select jsonb_agg(jsonb_build_object('id',id,'profile_id',profile_id,'padel_player_id',padel_player_id,'guest_name',guest_name,'rank_order',rank_order) order by rank_order,id),array_agg(id order by rank_order desc,id desc) into expected,ids from session_players where session_id=sid;
 perform public_competition_signup_reorder(sid,expected,ids);
 if (select array_agg(coalesce(profile_id::text,padel_player_id::text,guest_name) order by rank_order) from session_players where session_id=sid) is distinct from (select array_agg(coalesce(value->>'profile_id',value->>'padel_player_id',value->>'guest_name') order by (value->>'rank_order')::int desc) from jsonb_array_elements(original)) then raise exception 'Occupants not reversed'; end if;
 if (select count(*) from competition_signup_history where session_id=sid) <> 1 then raise exception 'Missing audit'; end if;
 rejected:=false;
 begin perform public_competition_signup_reorder(sid,expected,ids); exception when others then rejected:=sqlerrm like 'The lineup was changed elsewhere%'; end;
 if not rejected then raise exception 'Stale snapshot accepted'; end if;
 select jsonb_agg(jsonb_build_object('id',id,'profile_id',profile_id,'padel_player_id',padel_player_id,'guest_name',guest_name,'rank_order',rank_order) order by rank_order,id) into expected from session_players where session_id=sid;
 rejected:=false;
 begin perform public_competition_signup_reorder(sid,expected,array_fill(ids[1],array[cardinality(ids)])); exception when others then rejected:=sqlerrm like 'The new order must contain%'; end;
 if not rejected then raise exception 'Duplicate occupants accepted'; end if;
 perform public_competition_signup_reorder(sid,expected,ids);
 select jsonb_agg(to_jsonb(p) order by rank_order,id) into after_state from session_players p where session_id=sid;
 if original is distinct from after_state then raise exception 'Identity or metadata lost on reverse-and-restore'; end if;
 update game_sessions set competition_started_at=now() where id=sid;
 rejected:=false;
 begin perform public_competition_signup_reorder(sid,expected,ids); exception when others then rejected:=sqlerrm='Registration is closed'; end;
 if not rejected then raise exception 'Started competition accepted'; end if;
 if has_function_privilege('anon','public.public_competition_signup_reorder(uuid,jsonb,uuid[])','EXECUTE') or has_function_privilege('authenticated','public.public_competition_signup_reorder(uuid,jsonb,uuid[])','EXECUTE') then raise exception 'Public direct access allowed'; end if;
 if not has_function_privilege('service_role','public.public_competition_signup_reorder(uuid,jsonb,uuid[])','EXECUTE') then raise exception 'Service cannot execute'; end if;
end $$;

rollback;
