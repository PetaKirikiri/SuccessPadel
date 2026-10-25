begin;
insert into public.member_directory_access_links(token_hash,label,expires_at) values(encode(sha256(convert_to(repeat('6',64),'UTF8')),'hex'),'gender ranking fixture',now()+interval '1 hour');
insert into public.padel_players(id,display_name,gender,residency_status) values
('00000000-0000-4000-8000-00000000ff01','Man one','Male','local'),
('00000000-0000-4000-8000-00000000ff02','Man two','Male','local'),
('00000000-0000-4000-8000-00000000ff03','Woman one','Female','local'),
('00000000-0000-4000-8000-00000000ff04','Woman two','Female','local'),
('00000000-0000-4000-8000-00000000ff05','Holiday','Male','holiday'),
('00000000-0000-4000-8000-00000000ff06','Unknown',null,'local');
delete from public.member_rankings;
delete from public.member_gender_rankings;
insert into public.member_rankings values('00000000-0000-4000-8000-00000000ff01',1),('00000000-0000-4000-8000-00000000ff03',2);
set local role anon;
do $$ begin
 begin perform public.set_member_board_rank('men','00000000-0000-4000-8000-00000000ff01',1,null);raise exception 'Anonymous edit';exception when insufficient_privilege then null;end;
 perform public.set_member_board_rank('men','00000000-0000-4000-8000-00000000ff01',1,repeat('6',64));
 perform public.set_member_board_rank('men','00000000-0000-4000-8000-00000000ff02',2,repeat('6',64));
 perform public.set_member_board_rank('women','00000000-0000-4000-8000-00000000ff03',1,repeat('6',64));
 perform public.set_member_board_rank('women','00000000-0000-4000-8000-00000000ff04',2,repeat('6',64));
 perform public.set_member_board_rank('men','00000000-0000-4000-8000-00000000ff02',1,repeat('6',64));
 if (select id from public.list_member_ranking_board('men',repeat('6',64)) where position=1)<>'00000000-0000-4000-8000-00000000ff02' then raise exception 'Men reorder failed';end if;
 if (select id from public.list_member_ranking_board('women',repeat('6',64)) where position=1)<>'00000000-0000-4000-8000-00000000ff03' then raise exception 'Men move changed women';end if;
 if (select id from public.list_member_ranking_board('all',repeat('6',64)) where position=1)<>'00000000-0000-4000-8000-00000000ff01' then raise exception 'Men move changed overall';end if;
 perform public.set_member_board_rank('women','00000000-0000-4000-8000-00000000ff04',1,repeat('6',64));
 if (select id from public.list_member_ranking_board('women',repeat('6',64)) where position=1)<>'00000000-0000-4000-8000-00000000ff04' then raise exception 'Women reorder failed';end if;
 begin perform public.set_member_board_rank('men','00000000-0000-4000-8000-00000000ff03',1,repeat('6',64));raise exception 'Wrong gender accepted';exception when raise_exception then if sqlerrm<>'Player is not eligible for this ranking' then raise;end if;end;
 begin perform public.set_member_board_rank('men','00000000-0000-4000-8000-00000000ff05',1,repeat('6',64));raise exception 'Holiday accepted';exception when raise_exception then if sqlerrm<>'Player is not eligible for this ranking' then raise;end if;end;
 begin perform public.set_member_board_rank('women','00000000-0000-4000-8000-00000000ff06',1,repeat('6',64));raise exception 'Unknown gender accepted';exception when raise_exception then if sqlerrm<>'Player is not eligible for this ranking' then raise;end if;end;
 perform public.set_member_directory_attributes('00000000-0000-4000-8000-00000000ff01','{"gender":"Female"}',repeat('6',64));
 if exists(select 1 from public.list_member_ranking_board('men',repeat('6',64)) where id='00000000-0000-4000-8000-00000000ff01') then raise exception 'Old gender still listed';end if;
 perform public.set_member_directory_attributes('00000000-0000-4000-8000-00000000ff02','{"residency_status":"holiday"}',repeat('6',64));
 if exists(select 1 from public.list_member_ranking_board('men',repeat('6',64))) then raise exception 'Holiday change still listed';end if;
 perform public.set_member_directory_attributes('00000000-0000-4000-8000-00000000ff04','{"directory_hidden":true}',repeat('6',64));
 if exists(select 1 from public.list_member_ranking_board('women') where id='00000000-0000-4000-8000-00000000ff04') then raise exception 'Public hidden leak';end if;
end $$;
reset role;
delete from public.padel_players where id='00000000-0000-4000-8000-00000000ff04';
do $$ begin if exists(select 1 from public.member_gender_rankings where member_id='00000000-0000-4000-8000-00000000ff04') then raise exception 'Deleted player ranking orphan';end if;end $$;
rollback;
select 'PASS: independent men/women/overall order, access, eligibility, residency, gender changes, visibility and deletion; rolled back' as result;
