-- Private owner capabilities only permit the three directory attributes.
-- Raw tokens never live in the database or a public view.
alter table public.profiles add column if not exists court_member boolean;
alter table public.padel_players add column if not exists court_member boolean;
alter table public.padel_players add column if not exists gender text
  check (gender is null or gender in ('Male','Female'));

create table public.member_directory_access_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  label text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.member_directory_access_links enable row level security;
revoke all on public.member_directory_access_links from public, anon, authenticated;

create table public.member_directory_edit_log (
  id bigint generated always as identity primary key,
  member_id uuid not null,
  actor_id uuid,
  access_link_id uuid references public.member_directory_access_links(id),
  patch jsonb not null,
  previous_values jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.member_directory_edit_log enable row level security;
revoke all on public.member_directory_edit_log from public, anon, authenticated;

create function public.can_edit_member_directory(p_access_token text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select (auth.uid() is not null and exists (
    select 1 from public.coach_feedback_staff s join public.profiles p on p.id=s.profile_id
    where s.profile_id=auth.uid() and p.is_admin is true
  )) or (length(p_access_token)=64 and exists (
    select 1 from public.member_directory_access_links l
    where l.token_hash=encode(sha256(convert_to(p_access_token,'UTF8')),'hex')
      and l.revoked_at is null and l.expires_at>now()
  ));
$$;
revoke all on function public.can_edit_member_directory(text) from public;
grant execute on function public.can_edit_member_directory(text) to anon, authenticated;

create or replace view public.public_member_directory
with (security_barrier = true) as
with members as (
  select p.id, p.display_name, p.avatar_url, p.gender, p.skill_level, p.court_member
  from public.profiles p
  union all
  select pp.id, pp.display_name, pp.line_picture_url, pp.gender, pp.skill_level, pp.court_member
  from public.padel_players pp where pp.profile_id is null
)
select members.id, members.display_name, members.avatar_url, members.gender,
  members.skill_level, coalesce(history.levels, array[]::text[]) as history_levels, members.court_member
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


create function public.set_member_directory_attributes(p_member_id uuid, p_patch jsonb, p_access_token text default null)
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
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('gender','skill_level','court_member')) then
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
  select id into v_profile from public.profiles where id=p_member_id for update;
  if v_profile is null then
    select id,profile_id into v_guest,v_profile from public.padel_players where id=p_member_id for update;
    if v_guest is null then raise exception 'Player not found'; end if;
  end if;
  if v_profile is not null then
    select jsonb_build_object('gender',gender,'skill_level',skill_level,'court_member',court_member)
      into v_before from public.profiles where id=v_profile for update;
    update public.profiles set
      gender=case when p_patch ? 'gender' then p_patch->>'gender' else gender end,
      skill_level=case when p_patch ? 'skill_level' then p_patch->>'skill_level' else skill_level end,
      court_member=case when p_patch ? 'court_member' then (p_patch->>'court_member')::boolean else court_member end
    where id=v_profile;
    update public.padel_players pp set gender=p.gender,skill_level=p.skill_level,court_member=p.court_member,updated_at=now()
      from public.profiles p where p.id=v_profile and pp.profile_id=p.id;
  else
    select jsonb_build_object('gender',gender,'skill_level',skill_level,'court_member',court_member)
      into v_before from public.padel_players where id=v_guest;
    update public.padel_players set
      gender=case when p_patch ? 'gender' then p_patch->>'gender' else gender end,
      skill_level=case when p_patch ? 'skill_level' then p_patch->>'skill_level' else skill_level end,
      court_member=case when p_patch ? 'court_member' then (p_patch->>'court_member')::boolean else court_member end,
      updated_at=now() where id=v_guest;
  end if;
  select id into v_link from public.member_directory_access_links
    where token_hash=encode(sha256(convert_to(p_access_token,'UTF8')),'hex') and revoked_at is null and expires_at>now();
  insert into public.member_directory_edit_log(member_id,actor_id,access_link_id,patch,previous_values)
    values(coalesce(v_profile,v_guest),auth.uid(),v_link,p_patch,v_before);
  return query select * from public.public_member_directory where id=coalesce(v_profile,v_guest);
end;
$$;
revoke all on function public.set_member_directory_attributes(uuid,jsonb,text) from public;
grant execute on function public.set_member_directory_attributes(uuid,jsonb,text) to anon,authenticated;
notify pgrst, 'reload schema';
