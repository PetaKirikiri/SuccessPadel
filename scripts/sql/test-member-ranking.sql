-- Entire test runs inside a transaction and is rolled back.
insert into public.member_directory_access_links(token_hash,label,expires_at)
values(encode(sha256(convert_to(repeat('f',64),'UTF8')),'hex'),'ranking fixture',now()+interval '1 hour');
select set_config('test.rank_profile',(select id::text from public.profiles limit 1),true);
select set_config('test.rank_guest',(select id::text from public.padel_players where profile_id is null limit 1),true);
set local role anon;
do $$
declare a uuid:=current_setting('test.rank_profile')::uuid; b uuid:=current_setting('test.rank_guest')::uuid; r record; before_name text;
begin
  if has_table_privilege('anon','public.member_rankings','SELECT') then raise exception 'Ranking table exposed'; end if;
  begin perform public.set_member_rank(a,1,null); raise exception 'Anonymous move accepted'; exception when insufficient_privilege then null; end;
  begin perform public.set_member_directory_attributes(a,'{"residency_status":"local"}',null); raise exception 'Anonymous details accepted'; exception when insufficient_privilege then null; end;
  select display_name into before_name from public.list_owner_member_directory(repeat('f',64)) where id=a;
  select * into r from public.set_member_directory_attributes(a,'{"country":"TH","residency_status":"local"}',repeat('f',64));
  if r.country<>'TH' or r.residency_status<>'local' or r.display_name<>before_name then raise exception 'Profile details mismatch'; end if;
  select * into r from public.set_member_directory_attributes(b,'{"country":"NZ","residency_status":"holiday"}',repeat('f',64));
  if r.country<>'NZ' or r.residency_status<>'holiday' then raise exception 'Guest details mismatch'; end if;
  select * into r from public.set_member_directory_attributes(b,'{"country":null}',repeat('f',64));
  if r.country is not null or r.residency_status<>'holiday' then raise exception 'Partial detail clear failed'; end if;
  begin perform public.set_member_directory_attributes(a,'{"residency_status":"guess"}',repeat('f',64)); raise exception 'Invalid residency accepted'; exception when raise_exception then if sqlerrm<>'Invalid residency' then raise; end if; end;
  perform public.set_member_directory_attributes(b,'{"residency_status":"local"}',repeat('f',64));
  perform public.set_member_rank(a,1,repeat('f',64));
  perform public.set_member_rank(b,1,repeat('f',64));
  if (select position from public.list_member_rankings(repeat('f',64)) where id=b)<>1 or (select position from public.list_member_rankings(repeat('f',64)) where id=a)<>2 then raise exception 'Insert reorder failed'; end if;
  perform public.set_member_rank(b,2,repeat('f',64));
  if (select position from public.list_member_rankings(repeat('f',64)) where id=a)<>1 then raise exception 'Move failed'; end if;
  perform public.set_member_directory_attributes(a,'{"directory_hidden":true}',repeat('f',64));
  if exists(select 1 from public.list_member_rankings(null) where id=a) then raise exception 'Hidden ranking exposed'; end if;
  if not exists(select 1 from public.list_member_rankings(repeat('f',64)) where id=a) then raise exception 'Owner hidden ranking missing'; end if;
  perform public.set_member_rank(a,null,repeat('f',64));
  if exists(select 1 from public.list_member_rankings(repeat('f',64)) where id=a) then raise exception 'Removal failed'; end if;
  if (select position from public.list_member_rankings(repeat('f',64)) where id=b)<>1 then raise exception 'Removal compact failed'; end if;
  begin perform public.set_member_rank(a,0,repeat('f',64)); raise exception 'Invalid rank accepted'; exception when raise_exception then if sqlerrm<>'Invalid rank position' then raise; end if; end;
end $$;
reset role;
select 'Country, residency, ranking insert/move/remove, hidden players and owner gates passed' as result;
