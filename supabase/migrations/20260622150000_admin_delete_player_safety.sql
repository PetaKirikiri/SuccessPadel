-- Harden admin delete: guest/legacy cleanup only, never touch LINE-linked identities.

drop function if exists public.list_guest_players_with_games();

create or replace function public.player_is_line_linked(
  p_padel_player_id uuid default null,
  p_profile_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select true
        from public.padel_players pp
        where p_padel_player_id is not null
          and pp.id = p_padel_player_id
          and pp.line_user_id is not null
          and btrim(pp.line_user_id) <> ''
      ),
      false
    )
    or coalesce(
      (
        select true
        from public.padel_players pp
        join public.profiles pr on pr.id = pp.profile_id
        where p_padel_player_id is not null
          and pp.id = p_padel_player_id
          and pr.line_user_id is not null
          and btrim(pr.line_user_id) <> ''
      ),
      false
    )
    or coalesce(
      (
        select true
        from public.profiles pr
        where p_profile_id is not null
          and pr.id = p_profile_id
          and pr.line_user_id is not null
          and btrim(pr.line_user_id) <> ''
      ),
      false
    )
    or coalesce(
      (
        select true
        from public.padel_players pp
        where p_profile_id is not null
          and pp.profile_id = p_profile_id
          and pp.line_user_id is not null
          and btrim(pp.line_user_id) <> ''
      ),
      false
    );
$$;

create or replace function public.admin_delete_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_padel_id uuid;
  v_profile_id uuid;
  v_deleted int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_player_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;

  select pp.id, pp.profile_id
  into v_padel_id, v_profile_id
  from public.padel_players pp
  where pp.id = p_player_id;

  if not found then
    select pp.id, pp.profile_id
    into v_padel_id, v_profile_id
    from public.padel_players pp
    where pp.profile_id = p_player_id;
  end if;

  if v_profile_id is null and exists (
    select 1 from public.profiles pr where pr.id = p_player_id
  ) then
    v_profile_id := p_player_id;
  end if;

  if v_padel_id is null and v_profile_id is null then
    raise exception 'Player not found';
  end if;

  if public.player_is_line_linked(v_padel_id, v_profile_id) then
    raise exception 'Cannot delete LINE-linked player';
  end if;

  if v_profile_id is not null and exists (
    select 1
    from public.profiles pr
    where pr.id = v_profile_id
      and pr.is_admin
  ) then
    raise exception 'Cannot delete admin profile';
  end if;

  -- Guest padel row only (legacy duplicate cleanup; match history keeps rows with null padel_player_id).
  if v_padel_id is not null and v_profile_id is null then
    delete from public.padel_players pp
    where pp.id = v_padel_id
      and pp.profile_id is null
      and (pp.line_user_id is null or btrim(pp.line_user_id) = '');

    get diagnostics v_deleted = row_count;
    if v_deleted = 0 then
      raise exception 'Player not found or cannot be deleted';
    end if;
    return;
  end if;

  if v_profile_id is null then
    raise exception 'Player not found';
  end if;

  update public.game_sessions set created_by = null where created_by = v_profile_id;
  update public.matches set created_by = null where created_by = v_profile_id;
  update public.game_groups set created_by = null where created_by = v_profile_id;

  delete from public.padel_players pp
  where pp.profile_id = v_profile_id
    and (pp.line_user_id is null or btrim(pp.line_user_id) = '');

  delete from public.profiles pr
  where pr.id = v_profile_id
    and not pr.is_admin
    and (pr.line_user_id is null or btrim(pr.line_user_id) = '');

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'Player not found or cannot be deleted';
  end if;

  delete from auth.users where id = v_profile_id;
end;
$body$;

grant execute on function public.player_is_line_linked(uuid, uuid) to authenticated;
grant execute on function public.admin_delete_player(uuid) to authenticated;

create or replace function public.list_guest_players_with_games()
returns table (
  id uuid,
  display_name text,
  line_user_id text,
  game_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pp.id,
    pp.display_name,
    pp.line_user_id,
    (
      select count(*)::bigint
      from (
        select sp.id
        from public.session_players sp
        where sp.padel_player_id = pp.id
        union all
        select mp.id
        from public.match_players mp
        where mp.padel_player_id = pp.id
      ) involved
    ) as game_count
  from public.padel_players pp
  where pp.profile_id is null
    and (pp.line_user_id is null or btrim(pp.line_user_id) = '')
    and (
      exists (
        select 1
        from public.session_players sp
        where sp.padel_player_id = pp.id
      )
      or exists (
        select 1
        from public.match_players mp
        where mp.padel_player_id = pp.id
      )
    )
  order by pp.display_name;
$$;

grant execute on function public.list_guest_players_with_games() to authenticated;
