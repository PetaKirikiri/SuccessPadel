begin;
insert into public.member_directory_access_links(token_hash,label,expires_at)
values(encode(sha256(convert_to(repeat('7',64),'UTF8')),'hex'),'home rankings fixture',now()+interval '1 hour');
insert into public.padel_players(id,display_name,residency_status,directory_hidden) values
('00000000-0000-4000-8000-00000000ee01','Home one','local',false),
('00000000-0000-4000-8000-00000000ee02','Holiday','holiday',false),
('00000000-0000-4000-8000-00000000ee03','Unknown',null,false),
('00000000-0000-4000-8000-00000000ee04','Home hidden','local',true);
delete from public.member_rankings;
insert into public.member_rankings values
('00000000-0000-4000-8000-00000000ee01',1),('00000000-0000-4000-8000-00000000ee02',2),
('00000000-0000-4000-8000-00000000ee03',3),('00000000-0000-4000-8000-00000000ee04',4);
-- Management API sessions cannot LOAD safeupdate. Guard the SQL shape here;
-- real browser RPC verification covers PostgREST's loaded extension.
do $$ begin
 if pg_get_functiondef('public.set_member_rank(uuid,integer,text)'::regprocedure)
    ~* 'delete[[:space:]]+from[[:space:]]+public[.]member_rankings[[:space:]]*;' then
   raise exception 'Unqualified ranking delete fails under PostgREST safeupdate';
 end if;
end $$;
set local role anon;
do $$ begin
 if (select count(*) from public.list_member_rankings())<>1 then raise exception 'Public home filtering failed'; end if;
 if (select count(*) from public.list_member_rankings(repeat('7',64)))<>2 then raise exception 'Owner home filtering failed'; end if;
 if (select max(position) from public.list_member_rankings(repeat('7',64)))<>2 then raise exception 'Positions not compact'; end if;
 begin perform public.set_member_rank('00000000-0000-4000-8000-00000000ee02',1,repeat('7',64)); raise exception 'Holiday accepted'; exception when raise_exception then if sqlerrm<>'Only home players can be ranked' then raise; end if; end;
 begin perform public.set_member_rank('00000000-0000-4000-8000-00000000ee03',1,repeat('7',64)); raise exception 'Unset accepted'; exception when raise_exception then if sqlerrm<>'Only home players can be ranked' then raise; end if; end;
 begin perform public.set_member_rank('00000000-0000-4000-8000-00000000ee01',1,null); raise exception 'Anonymous move accepted'; exception when insufficient_privilege then null; end;
 perform public.set_member_rank('00000000-0000-4000-8000-00000000ee04',1,repeat('7',64));
 if (select position from public.list_member_rankings(repeat('7',64)) where id='00000000-0000-4000-8000-00000000ee04')<>1 then raise exception 'Home reorder failed'; end if;
 perform public.set_member_directory_attributes('00000000-0000-4000-8000-00000000ee01','{"residency_status":"holiday"}',repeat('7',64));
 if exists(select 1 from public.list_member_rankings(repeat('7',64)) where id='00000000-0000-4000-8000-00000000ee01') then raise exception 'Holiday switch still listed'; end if;
 perform public.set_member_rank('00000000-0000-4000-8000-00000000ee01',null,repeat('7',64));
end $$;
reset role;
rollback;
select 'PASS: home-only read/add, contiguous positions, reordering, holiday switch, removal, visibility and owner gate; rolled back' as result;
