-- Extend the existing player records, directory projection, owner gate and audit trail.
alter table public.padel_players add column if not exists country text;
alter table public.profiles add column residency_status text check (residency_status in ('local','holiday'));
alter table public.padel_players add column residency_status text check (residency_status in ('local','holiday'));

create or replace view public.owner_member_directory_data
with (security_barrier = true) as
with members as (
  select p.id, p.display_name, p.avatar_url, p.gender, p.skill_level, p.court_member, p.directory_hidden, p.country, p.residency_status,
    (nullif(btrim(p.line_user_id), '') is not null or exists (
      select 1 from public.padel_players linked where linked.profile_id = p.id
        and nullif(btrim(linked.line_user_id), '') is not null
    )) as has_line_account
  from public.profiles p
  union all
  select pp.id, pp.display_name, pp.line_picture_url, pp.gender, pp.skill_level, pp.court_member, pp.directory_hidden, pp.country, pp.residency_status,
    nullif(btrim(pp.line_user_id), '') is not null as has_line_account
  from public.padel_players pp where pp.profile_id is null
)
select members.id, members.display_name, members.avatar_url, members.gender,
  members.skill_level, coalesce(history.levels, array[]::text[]) as history_levels, members.court_member, members.has_line_account, members.directory_hidden, members.country, members.residency_status
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
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('gender','skill_level','court_member','directory_hidden','display_name','avatar_url','country','residency_status')) then
    raise exception 'Unsupported setting';
  end if;
  if p_patch ? 'country' and p_patch->'country'<>'null'::jsonb and (
    jsonb_typeof(p_patch->'country')<>'string' or length(btrim(p_patch->>'country')) not between 1 and 100
    or p_patch->>'country' ~ '[[:cntrl:]]') then raise exception 'Invalid country'; end if;
  if p_patch ? 'residency_status' and p_patch->'residency_status'<>'null'::jsonb and (
    jsonb_typeof(p_patch->'residency_status')<>'string' or p_patch->>'residency_status' not in ('local','holiday'))
    then raise exception 'Invalid residency'; end if;
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
    select jsonb_build_object('display_name',display_name,'avatar_url',avatar_url,'gender',gender,'skill_level',skill_level,'court_member',court_member,'directory_hidden',directory_hidden,'country',country,'residency_status',residency_status)
      into v_before from public.profiles where id=v_profile for update;
    update public.profiles set
      country=case when p_patch ? 'country' then btrim(p_patch->>'country') else country end,
      residency_status=case when p_patch ? 'residency_status' then p_patch->>'residency_status' else residency_status end,
      display_name=case when p_patch ? 'display_name' then btrim(p_patch->>'display_name') else display_name end,
      avatar_url=case when p_patch ? 'avatar_url' then p_patch->>'avatar_url' else avatar_url end,
      gender=case when p_patch ? 'gender' then p_patch->>'gender' else gender end,
      skill_level=case when p_patch ? 'skill_level' then p_patch->>'skill_level' else skill_level end,
      directory_hidden=case when p_patch ? 'directory_hidden' then (p_patch->>'directory_hidden')::boolean else directory_hidden end,
      court_member=case when p_patch ? 'court_member' then (p_patch->>'court_member')::boolean else court_member end
    where id=v_profile;
    update public.padel_players pp set display_name=case when p_patch ? 'display_name' then p.display_name else pp.display_name end,
      line_picture_url=case when p_patch ? 'avatar_url' then p.avatar_url else pp.line_picture_url end,
      country=p.country,residency_status=p.residency_status,gender=p.gender,skill_level=p.skill_level,court_member=p.court_member,directory_hidden=p.directory_hidden,updated_at=now()
      from public.profiles p where p.id=v_profile and pp.profile_id=p.id;
  else
    select jsonb_build_object('display_name',display_name,'avatar_url',line_picture_url,'gender',gender,'skill_level',skill_level,'court_member',court_member,'directory_hidden',directory_hidden,'country',country,'residency_status',residency_status)
      into v_before from public.padel_players where id=v_guest;
    update public.padel_players set
      country=case when p_patch ? 'country' then btrim(p_patch->>'country') else country end,
      residency_status=case when p_patch ? 'residency_status' then p_patch->>'residency_status' else residency_status end,
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

-- Manual club rankings are independent from competition scores.
create table public.member_rankings (
  member_id uuid primary key,
  position integer not null unique check (position > 0)
);
alter table public.member_rankings enable row level security;
revoke all on public.member_rankings from public,anon,authenticated;

create function public.list_member_rankings(p_access_token text default null)
returns table(id uuid,"position" integer)
language plpgsql stable security definer set search_path='' as $$
declare v_owner boolean := public.can_edit_member_directory(p_access_token);
begin
  if p_access_token is not null and v_owner is not true then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  return query
    select d.id, (row_number() over (order by min(r.position)))::integer
    from public.member_rankings r
    left join public.padel_players pp on pp.id=r.member_id
    join public.owner_member_directory_data d on d.id=coalesce(pp.profile_id,r.member_id)
    where v_owner is true or d.directory_hidden=false
    group by d.id order by min(r.position);
end;
$$;
revoke all on function public.list_member_rankings(text) from public;
grant execute on function public.list_member_rankings(text) to anon,authenticated;

create function public.set_member_rank(p_member_id uuid,p_position integer,p_access_token text default null)
returns table(id uuid,"position" integer)
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_order uuid[]; v_new uuid[]; v_count integer; v_before jsonb; v_link uuid;
begin
  if public.can_edit_member_directory(p_access_token) is not true then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  select p.id into v_id from public.profiles p where p.id=p_member_id;
  if v_id is null then select coalesce(p.profile_id,p.id) into v_id from public.padel_players p where p.id=p_member_id; end if;
  if v_id is null then raise exception 'Player not found'; end if;
  -- Serialize moves; two owners cannot create duplicate positions or lose a move.
  lock table public.member_rankings in exclusive mode;
  select coalesce(array_agg(r.id order by r.position),array[]::uuid[]),jsonb_agg(to_jsonb(r))
    into v_order,v_before from public.list_member_rankings(p_access_token) r;
  v_order := array_remove(v_order,v_id);
  v_count := cardinality(v_order);
  if p_position is not null and (p_position<1 or p_position>v_count+1) then raise exception 'Invalid rank position'; end if;
  if p_position is null then v_new:=v_order;
  else v_new:=v_order[1:p_position-1] || array[v_id] || v_order[p_position:v_count]; end if;
  delete from public.member_rankings;
  insert into public.member_rankings(member_id,position) select x.id,x.n::integer from unnest(v_new) with ordinality x(id,n);
  select l.id into v_link from public.member_directory_access_links l
    where l.token_hash=encode(sha256(convert_to(p_access_token,'UTF8')),'hex') and l.revoked_at is null and l.expires_at>now();
  insert into public.member_directory_edit_log(member_id,actor_id,access_link_id,patch,previous_values)
    values(v_id,auth.uid(),v_link,jsonb_build_object('rank',p_position),jsonb_build_object('ranking',v_before));
  return query select * from public.list_member_rankings(p_access_token);
end;
$$;
revoke all on function public.set_member_rank(uuid,integer,text) from public;
grant execute on function public.set_member_rank(uuid,integer,text) to anon,authenticated;
notify pgrst,'reload schema';
