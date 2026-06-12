-- Admin-only delete for duplicate guests or unlinked profiles (no LINE).

create or replace function public.admin_delete_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_padel_id uuid;
  v_profile_id uuid;
  v_line text;
  v_is_admin boolean;
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

  select id, profile_id into v_padel_id, v_profile_id
  from public.padel_players
  where id = p_player_id;

  if v_padel_id is not null then
    if v_profile_id is not null then
      select line_user_id, is_admin into v_line, v_is_admin
      from public.profiles
      where id = v_profile_id;

      if not found then
        delete from public.padel_players where id = v_padel_id;
        return;
      end if;

      if v_is_admin then
        raise exception 'Cannot delete admin profile';
      end if;
      if v_line is not null and btrim(v_line) <> '' then
        raise exception 'Cannot delete LINE-linked player';
      end if;

      delete from public.padel_players where profile_id = v_profile_id;
      delete from public.profiles where id = v_profile_id;
      delete from auth.users where id = v_profile_id;
      return;
    end if;

    delete from public.padel_players where id = v_padel_id;

    if not found then
      raise exception 'Player not found';
    end if;

    return;
  end if;

  select id, line_user_id, is_admin into v_profile_id, v_line, v_is_admin
  from public.profiles
  where id = p_player_id;

  if v_profile_id is null then
    raise exception 'Player not found';
  end if;

  if v_is_admin then
    raise exception 'Cannot delete admin profile';
  end if;

  if v_line is not null and btrim(v_line) <> '' then
    raise exception 'Cannot delete LINE-linked player';
  end if;

  delete from public.padel_players where profile_id = v_profile_id;
  delete from public.profiles where id = v_profile_id;
  delete from auth.users where id = v_profile_id;
end;
$body$;

grant execute on function public.admin_delete_player(uuid) to authenticated;

create or replace function public.get_player_profile(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'playtomic_number', p.playtomic_number,
    'racket', p.racket,
    'play_style', p.play_style,
    'preferred_side', p.preferred_side,
    'enjoys_fun_games', p.enjoys_fun_games,
    'usually_free', p.usually_free,
    'gender', p.gender,
    'dominant_hand', p.dominant_hand,
    'skill_level', p.skill_level,
    'created_at', p.created_at,
    'line_user_id', p.line_user_id,
    'is_admin', p.is_admin
  )
  from public.profiles p
  where p.id = p_profile_id;
$$;
