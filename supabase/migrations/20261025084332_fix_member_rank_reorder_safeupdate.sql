begin;
create or replace function public.set_member_rank(p_member_id uuid,p_position integer,p_access_token text default null)
returns table(id uuid,"position" integer)
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_order uuid[]; v_new uuid[]; v_count integer; v_before jsonb; v_link uuid; v_stored uuid[];
begin
  if public.can_edit_member_directory(p_access_token) is not true then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  select p.id into v_id from public.profiles p where p.id=p_member_id;
  if v_id is null then select coalesce(p.profile_id,p.id) into v_id from public.padel_players p where p.id=p_member_id; end if;
  if v_id is null then raise exception 'Player not found'; end if;
  if p_position is not null and not exists(select 1 from public.owner_member_directory_data d where d.id=v_id and d.residency_status='local') then
    raise exception 'Only home players can be ranked';
  end if;
  -- Serialize moves; two owners cannot create duplicate positions or lose a move.
  lock table public.member_rankings in exclusive mode;
  select coalesce(array_agg(r.id order by r.position),array[]::uuid[]),jsonb_agg(to_jsonb(r))
    into v_order,v_before from public.list_member_rankings(p_access_token) r;
  v_order := array_remove(v_order,v_id);
  v_count := cardinality(v_order);
  if p_position is not null and (p_position<1 or p_position>v_count+1) then raise exception 'Invalid rank position'; end if;
  if p_position is null then v_new:=v_order;
  else v_new:=v_order[1:p_position-1] || array[v_id] || v_order[p_position:v_count]; end if;
  -- Replace only the ranking rows captured under this transaction's table lock.
  -- PostgREST enables safeupdate, so unqualified DELETEs are rejected.
  select array_agg(r.member_id) into v_stored from public.member_rankings r;
  delete from public.member_rankings r where r.member_id = any(v_stored);
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
commit;
