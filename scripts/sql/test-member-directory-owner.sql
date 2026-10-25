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
  if has_table_privilege('anon','public.owner_member_directory_data','SELECT') then raise exception 'Hidden directory exposed'; end if;
  begin
    perform public.list_owner_member_directory(null);
    raise exception 'Anonymous owner listing accepted';
  exception when insufficient_privilege then null; end;
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
    begin
      perform public.set_member_directory_attributes(id,'{"display_name":null}',repeat('a',64));
      raise exception 'Null name accepted';
    exception when raise_exception then if sqlerrm<>'Name must be 1–100 characters' then raise; end if; end;
    begin
      perform public.set_member_directory_attributes(id,'{"display_name":"  "}',repeat('a',64));
      raise exception 'Empty name accepted';
    exception when raise_exception then if sqlerrm<>'Name must be 1–100 characters' then raise; end if; end;
    begin
      perform public.set_member_directory_attributes(id,'{"avatar_url":"javascript:alert(1)"}',repeat('a',64));
      raise exception 'Unsafe photo accepted';
    exception when raise_exception then if sqlerrm<>'Invalid photo URL' then raise; end if; end;
    begin
      perform public.set_member_directory_attributes(id,'{"display_name":"Forbidden"}',null);
      raise exception 'Anonymous identity edit accepted';
    exception when insufficient_privilege then null; end;
    select * into row from public.set_member_directory_attributes(id,'{"display_name":"  ทดสอบ player  ","avatar_url":"https://example.com/photo.png"}',repeat('a',64));
    if row.display_name <> 'ทดสอบ player' or row.avatar_url <> 'https://example.com/photo.png' then raise exception 'Identity save failed'; end if;
    select * into row from public.set_member_directory_attributes(id,'{"avatar_url":null}',repeat('a',64));
    if row.avatar_url is not null or row.display_name <> 'ทดสอบ player' then raise exception 'Photo removal changed name'; end if;
    select * into row from public.set_member_directory_attributes(id,'{"gender":"Female","skill_level":"Advanced","court_member":true}',repeat('a',64));
    if row.gender<>'Female' or row.skill_level<>'Advanced' or row.court_member is not true then raise exception 'Save mismatch'; end if;
    select * into row from public.set_member_directory_attributes(id,'{"court_member":false}',repeat('a',64));
    if row.gender<>'Female' or row.skill_level<>'Advanced' or row.court_member is not false then raise exception 'Partial save overwrote unrelated fields'; end if;
    select * into row from public.set_member_directory_attributes(id,'{"directory_hidden":true}',repeat('a',64));
    if row.directory_hidden is not true then raise exception 'Hide not returned to owner'; end if;
    if exists(select 1 from public.public_member_directory d where d.id=row.id) then raise exception 'Hidden player is public'; end if;
    if not exists(select 1 from public.list_owner_member_directory(repeat('a',64)) d where d.id=row.id and d.directory_hidden) then raise exception 'Owner cannot recover hidden player'; end if;
    select * into row from public.set_member_directory_attributes(id,'{"directory_hidden":false}',repeat('a',64));
    if not exists(select 1 from public.public_member_directory d where d.id=row.id) then raise exception 'Unhide failed'; end if;
    select * into row from public.set_member_directory_attributes(id,'{"gender":null,"skill_level":null,"court_member":null}',repeat('a',64));
    if row.gender is not null or row.skill_level is not null or row.court_member is not null then raise exception 'Clear mismatch'; end if;
  end loop;
end $$;
reset role;
do $$
declare target uuid := current_setting('test.profile_id')::uuid;
begin
  perform public.set_member_directory_attributes(target,'{"directory_hidden":true,"court_member":true,"gender":"Female","skill_level":"Advanced"}',repeat('a',64));
  if not exists(select 1 from public.profiles where id=target and directory_hidden and court_member and gender='Female' and skill_level='Advanced') then raise exception 'Profile fields not persisted'; end if;
  if exists(select 1 from public.padel_players where profile_id=target and directory_hidden is not true) then raise exception 'Linked player visibility not synced'; end if;
  target := current_setting('test.guest_id')::uuid;
  perform public.set_member_directory_attributes(target,'{"directory_hidden":true}',repeat('a',64));
  if not exists(select 1 from public.padel_players where id=target and directory_hidden) then raise exception 'Guest visibility not persisted'; end if;
end $$;
select 'Owner controls: profile and guest saves, partial updates, clear, private tables, expired/revoked/invalid tokens and anonymous rejection passed' as result;
