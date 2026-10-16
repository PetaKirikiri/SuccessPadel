-- Directory visibility is persisted on the canonical player record.
alter table public.profiles add column if not exists directory_hidden boolean not null default false;
alter table public.padel_players add column if not exists directory_hidden boolean not null default false;

create or replace view public.owner_member_directory_data
with (security_barrier = true) as
with members as (
  select p.id, p.display_name, p.avatar_url, p.gender, p.skill_level, p.court_member, p.directory_hidden,
    (nullif(btrim(p.line_user_id), '') is not null or exists (
      select 1 from public.padel_players linked where linked.profile_id = p.id
        and nullif(btrim(linked.line_user_id), '') is not null
    )) as has_line_account
  from public.profiles p
  union all
  select pp.id, pp.display_name, pp.line_picture_url, pp.gender, pp.skill_level, pp.court_member, pp.directory_hidden,
    nullif(btrim(pp.line_user_id), '') is not null as has_line_account
  from public.padel_players pp where pp.profile_id is null
)
select members.id, members.display_name, members.avatar_url, members.gender,
  members.skill_level, coalesce(history.levels, array[]::text[]) as history_levels, members.court_member, members.has_line_account, members.directory_hidden
from members
left join lateral (
  select array_agg(recent.skill_level order by recent.starts_at desc) as levels
  from (
    select s.id, s.skill_level, s.starts_at
    from public.game_sessions s
    where s.game_kind = 'competition' and s.ends_at < now()
      and s.skill_level is not null
      and exists (
        select 1 from public.matches m
        join public.match_players mp on mp.match_id = m.id
        join public.padel_players pp on pp.id = mp.padel_player_id
        where m.session_id = s.id and m.score_summary ~ '^[0-9]+[[:space:]]*-[[:space:]]*[0-9]+$'
          and (pp.id = members.id or pp.profile_id = members.id)
      )
    order by s.starts_at desc limit 5
  ) recent
) history on true;
revoke all on public.owner_member_directory_data from public, anon, authenticated;

-- Public readers never receive hidden entries, even through the Data API.
create or replace view public.public_member_directory with (security_barrier = true) as
select * from public.owner_member_directory_data where directory_hidden = false;

create function public.list_owner_member_directory(p_access_token text default null)
returns setof public.public_member_directory
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.can_edit_member_directory(p_access_token) is not true then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  return query select * from public.owner_member_directory_data order by display_name;
end;
$$;
revoke all on function public.list_owner_member_directory(text) from public;
grant execute on function public.list_owner_member_directory(text) to anon,authenticated;

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
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('gender','skill_level','court_member','directory_hidden')) then
    raise exception 'Unsupported setting';
  end if;
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
    select jsonb_build_object('gender',gender,'skill_level',skill_level,'court_member',court_member,'directory_hidden',directory_hidden)
      into v_before from public.profiles where id=v_profile for update;
    update public.profiles set
      gender=case when p_patch ? 'gender' then p_patch->>'gender' else gender end,
      skill_level=case when p_patch ? 'skill_level' then p_patch->>'skill_level' else skill_level end,
      directory_hidden=case when p_patch ? 'directory_hidden' then (p_patch->>'directory_hidden')::boolean else directory_hidden end,
      court_member=case when p_patch ? 'court_member' then (p_patch->>'court_member')::boolean else court_member end
    where id=v_profile;
    update public.padel_players pp set gender=p.gender,skill_level=p.skill_level,court_member=p.court_member,directory_hidden=p.directory_hidden,updated_at=now()
      from public.profiles p where p.id=v_profile and pp.profile_id=p.id;
  else
    select jsonb_build_object('gender',gender,'skill_level',skill_level,'court_member',court_member,'directory_hidden',directory_hidden)
      into v_before from public.padel_players where id=v_guest;
    update public.padel_players set
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
