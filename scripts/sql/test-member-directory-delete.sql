begin;
insert into public.member_directory_access_links(token_hash,label,expires_at)
values(encode(sha256(convert_to(repeat('9',64),'UTF8')),'hex'),'delete fixture',now()+interval '1 hour'),
(encode(sha256(convert_to(repeat('8',64),'UTF8')),'hex'),'expired delete fixture',now()-interval '1 hour');
insert into public.padel_players(id,display_name,line_user_id) values
('00000000-0000-4000-8000-00000000dd01','Delete fixture',null),
('00000000-0000-4000-8000-00000000dd02','Linked fixture','test-delete-line'),
('00000000-0000-4000-8000-00000000dd03','History fixture',null);
-- A cascade reference must block deletion, rather than silently deleting the child.
create table public.member_delete_history_fixture(player_id uuid references public.padel_players(id) on delete cascade);
insert into public.member_delete_history_fixture values('00000000-0000-4000-8000-00000000dd03');
insert into public.member_directory_contacts(member_id,whatsapp_number) values('00000000-0000-4000-8000-00000000dd01','12025550123');
insert into auth.users(id,raw_user_meta_data) values
('00000000-0000-4000-8000-00000000dd04','{"display_name":"Delete profile fixture"}'),
('00000000-0000-4000-8000-00000000dd05','{"display_name":"Protected admin fixture"}');
update public.profiles set is_admin=true where id='00000000-0000-4000-8000-00000000dd05';
set local role anon;
do $$
begin
  begin perform public.delete_member_directory_player('00000000-0000-4000-8000-00000000dd01',null); raise exception 'Anonymous delete allowed'; exception when insufficient_privilege then null; end;
  begin perform public.delete_member_directory_player('00000000-0000-4000-8000-00000000dd01',repeat('8',64)); raise exception 'Expired delete allowed'; exception when insufficient_privilege then null; end;
  begin perform public.delete_member_directory_player('00000000-0000-4000-8000-00000000dd02',repeat('9',64)); raise exception 'Linked delete allowed'; exception when raise_exception then if sqlerrm not like 'Court-login accounts%' then raise; end if; end;
  begin perform public.delete_member_directory_player('00000000-0000-4000-8000-00000000dd03',repeat('9',64)); raise exception 'History delete allowed'; exception when raise_exception then if sqlerrm not like 'This player has linked records%' then raise; end if; end;
  begin perform public.delete_member_directory_player('00000000-0000-4000-8000-00000000dd05',repeat('9',64)); raise exception 'Admin delete allowed'; exception when raise_exception then if sqlerrm<>'Cannot delete admin profile' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000dd04',true);
  begin perform public.delete_member_directory_player('00000000-0000-4000-8000-00000000dd04',repeat('9',64)); raise exception 'Self delete allowed'; exception when raise_exception then if sqlerrm<>'Cannot delete your own account' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','',true);
  perform public.delete_member_directory_player('00000000-0000-4000-8000-00000000dd04',repeat('9',64));
  perform public.set_member_directory_attributes('00000000-0000-4000-8000-00000000dd01','{"residency_status":"local"}',repeat('9',64));
  perform public.set_member_rank('00000000-0000-4000-8000-00000000dd01' ,1,repeat('9',64));
  perform public.delete_member_directory_player('00000000-0000-4000-8000-00000000dd01',repeat('9',64));
  if exists(select 1 from public.list_owner_member_directory(repeat('9',64)) where id='00000000-0000-4000-8000-00000000dd01') then raise exception 'Deleted player still listed'; end if;
end $$;
reset role;
do $$
begin
  if exists(select 1 from auth.users where id='00000000-0000-4000-8000-00000000dd04') or exists(select 1 from public.profiles where id='00000000-0000-4000-8000-00000000dd04') then raise exception 'Profile cleanup failed'; end if;
  if exists(select 1 from public.member_directory_contacts where member_id='00000000-0000-4000-8000-00000000dd01') then raise exception 'Contact orphan'; end if;
  if exists(select 1 from public.member_rankings where member_id='00000000-0000-4000-8000-00000000dd01') then raise exception 'Ranking orphan'; end if;
  if exists(select 1 from (select position,row_number() over(order by position) n from public.member_rankings) r where position<>n) then raise exception 'Ranking gap'; end if;
  if not exists(select 1 from public.member_directory_edit_log where member_id='00000000-0000-4000-8000-00000000dd01' and patch='{"deleted":true}') then raise exception 'No delete audit'; end if;
  if not exists(select 1 from public.member_delete_history_fixture) then raise exception 'History lost'; end if;
end $$;
rollback;
select 'PASS: owner gate, expired token, login protection, history protection, deletion, contacts, ranking and audit; fixtures rolled back' as result;
