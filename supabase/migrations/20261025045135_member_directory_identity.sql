-- Extend the existing owner gate and audit trail to name and photo edits.
create or replace function public.set_member_directory_attributes(p_member_id uuid, p_patch jsonb, p_access_token text default null)
returns setof public.public_member_directory
language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_guest uuid;
  v_before jsonb;
  v_link uuid;
begin
  if public.can_edit_member_directory(p_access_token) is not true then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then
    raise exception 'Choose a setting to change';
  end if;
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('gender','skill_level','court_member','directory_hidden','display_name','avatar_url')) then
    raise exception 'Unsupported setting';
  end if;
  if p_patch ? 'display_name' and (
    jsonb_typeof(p_patch->'display_name') <> 'string'
    or length(btrim(p_patch->>'display_name')) not between 1 and 100
    or p_patch->>'display_name' ~ '[[:cntrl:]]'
  ) then raise exception 'Name must be 1–100 characters'; end if;
  if p_patch ? 'avatar_url' and p_patch->'avatar_url' <> 'null'::jsonb and (
    jsonb_typeof(p_patch->'avatar_url') <> 'string'
    or length(p_patch->>'avatar_url') > 2048
    or p_patch->>'avatar_url' !~ '^https://[^[:space:]]+$'
  ) then raise exception 'Invalid photo URL'; end if;
  if p_patch ? 'gender' and p_patch->'gender'<>'null'::jsonb
    and (jsonb_typeof(p_patch->'gender')<>'string' or p_patch->>'gender' not in ('Male','Female')) then
    raise exception 'Invalid gender';
  end if;
  if p_patch ? 'skill_level' and p_patch->'skill_level'<>'null'::jsonb
    and (jsonb_typeof(p_patch->'skill_level')<>'string' or p_patch->>'skill_level' not in ('Beginner','Low Inter','Intermediate','Advanced','Open')) then
    raise exception 'Invalid level';
  end if;
  if p_patch ? 'court_member' and jsonb_typeof(p_patch->'court_member') not in ('boolean','null') then
    raise exception 'Invalid court membership';
  end if;
  if p_patch ? 'directory_hidden' and jsonb_typeof(p_patch->'directory_hidden') <> 'boolean' then
    raise exception 'Invalid visibility';
  end if;
  select id into v_profile from public.profiles where id=p_member_id for update;
  if v_profile is null then
    select id,profile_id into v_guest,v_profile from public.padel_players where id=p_member_id for update;
    if v_guest is null then raise exception 'Player not found'; end if;
  end if;
  if v_profile is not null then
    select jsonb_build_object('display_name',display_name,'avatar_url',avatar_url,'gender',gender,'skill_level',skill_level,'court_member',court_member,'directory_hidden',directory_hidden)
      into v_before from public.profiles where id=v_profile for update;
    update public.profiles set
      display_name=case when p_patch ? 'display_name' then btrim(p_patch->>'display_name') else display_name end,
      avatar_url=case when p_patch ? 'avatar_url' then p_patch->>'avatar_url' else avatar_url end,
      gender=case when p_patch ? 'gender' then p_patch->>'gender' else gender end,
      skill_level=case when p_patch ? 'skill_level' then p_patch->>'skill_level' else skill_level end,
      directory_hidden=case when p_patch ? 'directory_hidden' then (p_patch->>'directory_hidden')::boolean else directory_hidden end,
      court_member=case when p_patch ? 'court_member' then (p_patch->>'court_member')::boolean else court_member end
    where id=v_profile;
    update public.padel_players pp set display_name=case when p_patch ? 'display_name' then p.display_name else pp.display_name end,
      line_picture_url=case when p_patch ? 'avatar_url' then p.avatar_url else pp.line_picture_url end,
      gender=p.gender,skill_level=p.skill_level,court_member=p.court_member,directory_hidden=p.directory_hidden,updated_at=now()
      from public.profiles p where p.id=v_profile and pp.profile_id=p.id;
  else
    select jsonb_build_object('display_name',display_name,'avatar_url',line_picture_url,'gender',gender,'skill_level',skill_level,'court_member',court_member,'directory_hidden',directory_hidden)
      into v_before from public.padel_players where id=v_guest;
    update public.padel_players set
      display_name=case when p_patch ? 'display_name' then btrim(p_patch->>'display_name') else display_name end,
      line_picture_url=case when p_patch ? 'avatar_url' then p_patch->>'avatar_url' else line_picture_url end,
      gender=case when p_patch ? 'gender' then p_patch->>'gender' else gender end,
      skill_level=case when p_patch ? 'skill_level' then p_patch->>'skill_level' else skill_level end,
      directory_hidden=case when p_patch ? 'directory_hidden' then (p_patch->>'directory_hidden')::boolean else directory_hidden end,
      court_member=case when p_patch ? 'court_member' then (p_patch->>'court_member')::boolean else court_member end,
      updated_at=now() where id=v_guest;
  end if;
  select id into v_link from public.member_directory_access_links
    where token_hash=encode(sha256(convert_to(p_access_token,'UTF8')),'hex') and revoked_at is null and expires_at>now();
  insert into public.member_directory_edit_log(member_id,actor_id,access_link_id,patch,previous_values)
    values(coalesce(v_profile,v_guest),auth.uid(),v_link,p_patch,v_before);
  return query select * from public.owner_member_directory_data where id=coalesce(v_profile,v_guest);
end;
$$;

notify pgrst, 'reload schema';
