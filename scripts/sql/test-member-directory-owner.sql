-- Run after the migration inside a transaction, then ROLLBACK.
-- Fixed tokens are fixtures only; they must never be persisted.
insert into public.member_directory_access_links(token_hash,label,expires_at)
values(encode(sha256(convert_to(repeat('a',64),'UTF8')),'hex'),'test valid',now()+interval '1 hour'),
(encode(sha256(convert_to(repeat('b',64),'UTF8')),'hex'),'test expired',now()-interval '1 hour'),
(encode(sha256(convert_to(repeat('c',64),'UTF8')),'hex'),'test revoked',now()+interval '1 hour');
update public.member_directory_access_links set revoked_at=now() where label='test revoked';
select set_config('test.profile_id',(select id::text from public.profiles limit 1),true);
select set_config('test.guest_id',(select id::text from public.padel_players where profile_id is null limit 1),true);
set local role anon;
do $$
declare id uuid; row public.public_member_directory;
begin
  if public.can_edit_member_directory(null) is true or public.can_edit_member_directory(repeat('b',64)) is true
     or public.can_edit_member_directory(repeat('c',64)) is true or public.can_edit_member_directory(repeat('d',64)) is true then
    raise exception 'Invalid capability accepted'; end if;
  if public.can_edit_member_directory(repeat('a',64)) is not true then raise exception 'Valid link rejected'; end if;
  if has_table_privilege('anon','public.member_directory_access_links','SELECT') or has_table_privilege('anon','public.member_directory_access_links','INSERT')
     or has_table_privilege('anon','public.member_directory_edit_log','SELECT') then raise exception 'Private table exposed'; end if;
  foreach id in array array[current_setting('test.profile_id')::uuid,current_setting('test.guest_id')::uuid] loop
    begin
      perform public.set_member_directory_attributes(id,'{"gender":"Female"}',null);
      raise exception 'Anonymous write accepted';
    exception when insufficient_privilege then null; end;
    begin
      perform public.set_member_directory_attributes(id,'{"is_admin":true}',repeat('a',64));
      raise exception 'Privilege escalation accepted';
    exception when raise_exception then if sqlerrm<>'Unsupported setting' then raise; end if; end;
    begin
      perform public.set_member_directory_attributes(id,'{"gender":"invalid"}',repeat('a',64));
      raise exception 'Invalid value accepted';
    exception when raise_exception then if sqlerrm<>'Invalid gender' then raise; end if; end;
    select * into row from public.set_member_directory_attributes(id,'{"gender":"Female","skill_level":"Advanced","court_member":true}',repeat('a',64));
    if row.gender<>'Female' or row.skill_level<>'Advanced' or row.court_member is not true then raise exception 'Save mismatch'; end if;
    select * into row from public.set_member_directory_attributes(id,'{"court_member":false}',repeat('a',64));
    if row.gender<>'Female' or row.skill_level<>'Advanced' or row.court_member is not false then raise exception 'Partial save overwrote unrelated fields'; end if;
    select * into row from public.set_member_directory_attributes(id,'{"gender":null,"skill_level":null,"court_member":null}',repeat('a',64));
    if row.gender is not null or row.skill_level is not null or row.court_member is not null then raise exception 'Clear mismatch'; end if;
  end loop;
end $$;
reset role;
select 'Owner controls: profile and guest saves, partial updates, clear, private tables, expired/revoked/invalid tokens and anonymous rejection passed' as result;
