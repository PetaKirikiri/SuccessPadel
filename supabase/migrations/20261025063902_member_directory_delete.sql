-- Owner-card deletion reuses the directory owner gate; never cascades game history.
create or replace function public.delete_member_directory_player(p_member_id uuid, p_access_token text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_guests uuid[] := array[]::uuid[];
  v_link uuid;
  v_before jsonb;
  v_ref record;
  v_ids uuid[];
  v_used boolean;
begin
  if public.can_edit_member_directory(p_access_token) is not true then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  select id into v_profile from public.profiles where id=p_member_id for update;
  if v_profile is null then
    select profile_id into v_profile from public.padel_players where id=p_member_id for update;
    if not found then raise exception 'Player not found'; end if;
  end if;
  if v_profile is not null then
    perform 1 from public.profiles where id=v_profile for update;
    if v_profile=auth.uid() then raise exception 'Cannot delete your own account'; end if;
    if exists(select 1 from public.profiles where id=v_profile and is_admin) then
      raise exception 'Cannot delete admin profile';
    end if;
  end if;
  perform 1 from public.padel_players where id=p_member_id or profile_id=v_profile for update;
  select coalesce(array_agg(id),array[]::uuid[]) into v_guests
    from public.padel_players where id=p_member_id or profile_id=v_profile;
  if public.player_is_line_linked(p_member_id,v_profile) or exists(
    select 1 from public.padel_players where id=any(v_guests) and nullif(btrim(line_user_id),'') is not null
  ) then raise exception 'Court-login accounts cannot be deleted here. Use visibility to hide this player.'; end if;

  -- Check every referencing relation, including future game tables, before any deletion.
  -- Registry rows are deleted together; built-in auth records follow normal account cleanup.
  for v_ref in
    select n.nspname,c.relname,a.attname,f.confrelid
    from pg_catalog.pg_constraint f
    join pg_catalog.pg_class c on c.oid=f.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=f.conrelid and a.attnum=any(f.conkey)
    where f.contype='f' and f.confrelid in ('public.profiles'::regclass,'public.padel_players'::regclass,'auth.users'::regclass)
      and n.nspname<>'auth'
      and f.conrelid not in ('public.profiles'::regclass,'public.padel_players'::regclass)
  loop
    v_ids := case when v_ref.confrelid='public.padel_players'::regclass then v_guests else array[v_profile] end;
    execute format('select exists(select 1 from %I.%I where %I = any($1))',v_ref.nspname,v_ref.relname,v_ref.attname)
      into v_used using v_ids;
    if v_used then raise exception 'This player has linked records or game history. Use visibility to hide them instead.'; end if;
  end loop;

  select jsonb_build_object('player',to_jsonb(d),'contacts',(select to_jsonb(c) from public.member_directory_contacts c where c.member_id=d.id),
    'ranking',(select to_jsonb(r) from public.member_rankings r where r.member_id=d.id))
    into v_before from public.owner_member_directory_data d where d.id=coalesce(v_profile,p_member_id);
  select id into v_link from public.member_directory_access_links
    where token_hash=encode(sha256(convert_to(p_access_token,'UTF8')),'hex') and revoked_at is null and expires_at>now();
  insert into public.member_directory_edit_log(member_id,actor_id,access_link_id,patch,previous_values)
    values(coalesce(v_profile,p_member_id),auth.uid(),v_link,'{"deleted":true}',coalesce(v_before,'{}'));
  delete from public.member_directory_contacts where member_id=any(v_guests) or member_id=v_profile;
  if exists(select 1 from public.member_rankings where member_id=coalesce(v_profile,p_member_id)) then
    perform public.set_member_rank(coalesce(v_profile,p_member_id),null,p_access_token);
  end if;
  delete from public.padel_players where id=any(v_guests);
  if v_profile is not null then
    delete from public.profiles where id=v_profile;
    delete from auth.users where id=v_profile;
  end if;
end;
$$;
revoke all on function public.delete_member_directory_player(uuid,text) from public;
grant execute on function public.delete_member_directory_player(uuid,text) to anon,authenticated;
notify pgrst,'reload schema';
