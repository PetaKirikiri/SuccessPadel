-- Execute in a transaction and roll back all fixtures.
insert into public.member_directory_access_links(token_hash,label,expires_at)
values(encode(sha256(convert_to(repeat('e',64),'UTF8')),'hex'),'contact test',now()+interval '1 hour');
select set_config('test.contact_profile',(select id::text from public.profiles limit 1),true);
select set_config('test.contact_guest',(select id::text from public.padel_players where profile_id is null limit 1),true);
set local role anon;
do $$
declare target uuid; saved record; patch jsonb; old_login boolean;
begin
  if has_table_privilege('anon','public.member_directory_contacts','SELECT') or has_table_privilege('authenticated','public.member_directory_contacts','SELECT') then raise exception 'Contacts exposed'; end if;
  begin
    perform public.list_member_directory_contacts(null);
    raise exception 'Anonymous listing accepted';
  exception when insufficient_privilege then null; end;
  foreach target in array array[current_setting('test.contact_profile')::uuid,current_setting('test.contact_guest')::uuid] loop
    select has_line_account into old_login from public.list_owner_member_directory(repeat('e',64)) where id=target;
    begin
      perform public.set_member_directory_contacts(target,'{"whatsapp_number":"66812345678"}',null);
      raise exception 'Anonymous write accepted';
    exception when insufficient_privilege then null; end;
    select * into saved from public.set_member_directory_contacts(target,'{"whatsapp_number":"66812345678","line_contact_url":"https://line.me/ti/p/~fixture"}',repeat('e',64));
    if saved.whatsapp_number<>'66812345678' or saved.line_contact_url<>'https://line.me/ti/p/~fixture' then raise exception 'Save mismatch'; end if;
    select * into saved from public.set_member_directory_contacts(target,'{"whatsapp_number":null}',repeat('e',64));
    if saved.whatsapp_number is not null or saved.line_contact_url<>'https://line.me/ti/p/~fixture' then raise exception 'Partial clear mismatch'; end if;
    if not exists(select 1 from public.list_member_directory_contacts(repeat('e',64)) c where c.id=target and c.line_contact_url=saved.line_contact_url) then raise exception 'Owner read failed'; end if;
    if old_login is distinct from (select has_line_account from public.list_owner_member_directory(repeat('e',64)) where id=target) then raise exception 'Login changed'; end if;
    foreach patch in array array['{"whatsapp_number":"0812345678"}'::jsonb,'{"line_contact_url":"https://evil.test"}'::jsonb,'{"is_admin":true}'::jsonb] loop
      begin
        perform public.set_member_directory_contacts(target,patch,repeat('e',64));
        raise exception 'Invalid patch accepted';
      exception when raise_exception then if sqlerrm='Invalid patch accepted' then raise; end if; end;
    end loop;
  end loop;
end $$;
reset role;
select 'Owner-only contact saves, partial clear, validation and unchanged login passed' as result;
