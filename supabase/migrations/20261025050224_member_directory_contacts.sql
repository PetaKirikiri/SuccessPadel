-- Contact details stay owner-only, separate from login identifiers and the public directory.
create table public.member_directory_contacts (
  member_id uuid primary key,
  line_contact_url text,
  whatsapp_number text,
  updated_at timestamptz not null default now(),
  constraint valid_line_contact check (line_contact_url is null or (
    length(line_contact_url) <= 512 and line_contact_url ~ '^https://(line[.]me/(R/)?ti/p/[^[:space:]?#]+|lin[.]ee/[A-Za-z0-9_-]+)$')),
  constraint valid_whatsapp_number check (whatsapp_number is null or whatsapp_number ~ '^[1-9][0-9]{6,14}$')
);
alter table public.member_directory_contacts enable row level security;
revoke all on public.member_directory_contacts from public,anon,authenticated;

create function public.list_member_directory_contacts(p_access_token text default null)
returns table(id uuid,line_contact_url text,whatsapp_number text)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.can_edit_member_directory(p_access_token) is not true then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  return query select d.id,c.line_contact_url,c.whatsapp_number
    from public.owner_member_directory_data d
    left join public.member_directory_contacts c on c.member_id=d.id;
end;
$$;
revoke all on function public.list_member_directory_contacts(text) from public;
grant execute on function public.list_member_directory_contacts(text) to anon,authenticated;

create function public.set_member_directory_contacts(p_member_id uuid,p_patch jsonb,p_access_token text default null)
returns table(id uuid,line_contact_url text,whatsapp_number text)
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_before jsonb; v_link uuid;
begin
  if public.can_edit_member_directory(p_access_token) is not true then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb
    or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('line_contact_url','whatsapp_number')) then
    raise exception 'Unsupported contact setting';
  end if;
  if p_patch ? 'line_contact_url' and p_patch->'line_contact_url'<>'null'::jsonb and (
    jsonb_typeof(p_patch->'line_contact_url')<>'string' or length(p_patch->>'line_contact_url')>512
    or p_patch->>'line_contact_url' !~ '^https://(line[.]me/(R/)?ti/p/[^[:space:]?#]+|lin[.]ee/[A-Za-z0-9_-]+)$') then
    raise exception 'Invalid LINE profile link';
  end if;
  if p_patch ? 'whatsapp_number' and p_patch->'whatsapp_number'<>'null'::jsonb and (
    jsonb_typeof(p_patch->'whatsapp_number')<>'string' or p_patch->>'whatsapp_number' !~ '^[1-9][0-9]{6,14}$') then
    raise exception 'Invalid international WhatsApp number';
  end if;
  select p.id into v_id from public.profiles p where p.id=p_member_id for update;
  if v_id is null then
    select coalesce(p.profile_id,p.id) into v_id from public.padel_players p where p.id=p_member_id for update;
  end if;
  if v_id is null then raise exception 'Player not found'; end if;
  insert into public.member_directory_contacts(member_id) values(v_id) on conflict do nothing;
  select jsonb_build_object('line_contact_url',c.line_contact_url,'whatsapp_number',c.whatsapp_number)
    into v_before from public.member_directory_contacts c where c.member_id=v_id for update;
  update public.member_directory_contacts c set
    line_contact_url=case when p_patch ? 'line_contact_url' then p_patch->>'line_contact_url' else c.line_contact_url end,
    whatsapp_number=case when p_patch ? 'whatsapp_number' then p_patch->>'whatsapp_number' else c.whatsapp_number end,
    updated_at=now() where c.member_id=v_id;
  select l.id into v_link from public.member_directory_access_links l
    where l.token_hash=encode(sha256(convert_to(p_access_token,'UTF8')),'hex') and l.revoked_at is null and l.expires_at>now();
  insert into public.member_directory_edit_log(member_id,actor_id,access_link_id,patch,previous_values)
    values(v_id,auth.uid(),v_link,p_patch,v_before);
  return query select c.member_id,c.line_contact_url,c.whatsapp_number from public.member_directory_contacts c where c.member_id=v_id;
end;
$$;
revoke all on function public.set_member_directory_contacts(uuid,jsonb,text) from public;
grant execute on function public.set_member_directory_contacts(uuid,jsonb,text) to anon,authenticated;
notify pgrst,'reload schema';
