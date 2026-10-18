-- Public signup may select only identities already visible in the public directory.
-- Keep the existing lock, stale-write checks, audit and pair-preservation operation.
create or replace function public.public_competition_member_signup(p_session_id uuid, p_changes jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  c jsonb;
  canonical_changes jsonb := '[]'::jsonb;
  member uuid;
  canonical_name text;
  profile uuid;
  player uuid;
  roster uuid;
begin
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) not between 1 and 64 then
    raise exception 'Invalid changes';
  end if;
  for c in select value from jsonb_array_elements(p_changes) loop
    member := nullif(c->>'member_id','')::uuid;
    if member is not null then
      select display_name into canonical_name from public.public_member_directory where id=member;
      if not found then raise exception 'Member is unavailable'; end if;
      c := jsonb_set(c,'{name}',to_jsonb(canonical_name));
    end if;
    canonical_changes := canonical_changes || jsonb_build_array(c);
  end loop;
  perform public.public_competition_signup(p_session_id,canonical_changes);
  for c in select value from jsonb_array_elements(canonical_changes) loop
    member := nullif(c->>'member_id','')::uuid;
    if member is null then continue; end if;
    select id into profile from public.profiles where id=member;
    select id into player from public.padel_players where id=member and profile_id is null;
    if profile is null and player is null then raise exception 'Member is unavailable'; end if;
    select id into roster from public.session_players where session_id=p_session_id and rank_order=(c->>'slot')::integer;
    if exists(select 1 from public.session_players sp
      left join public.padel_players pp on pp.id=sp.padel_player_id
      where sp.session_id=p_session_id and sp.id<>roster
      and ((profile is not null and (sp.profile_id=profile or pp.profile_id=profile))
        or (player is not null and sp.padel_player_id=player))) then
      raise exception 'This member already has a slot';
    end if;
    update public.session_players set profile_id=profile,padel_player_id=player,
      guest_name=case when profile is null then c->>'name' else null end,guest_email=null where id=roster;
    update public.session_pairs set player_a_id=profile where session_id=p_session_id and roster_a_id=roster;
    update public.session_pairs set player_b_id=profile where session_id=p_session_id and roster_b_id=roster;
  end loop;
end $$;
revoke all on function public.public_competition_member_signup(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.public_competition_member_signup(uuid,jsonb) to service_role;
