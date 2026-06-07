-- When claiming a guest slot, clear guest_name so session_players check passes.

create or replace function public.link_padel_player_to_profile(
  p_padel_player_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if not public.is_admin() and auth.uid() is distinct from p_profile_id then
    raise exception 'Not allowed';
  end if;

  update public.padel_players
  set profile_id = p_profile_id,
      linked_at = now(),
      updated_at = now()
  where id = p_padel_player_id
    and profile_id is null;

  if not found then
    raise exception 'Player not found or already linked';
  end if;

  update public.session_players
  set profile_id = p_profile_id,
      guest_name = null,
      padel_player_id = p_padel_player_id
  where padel_player_id = p_padel_player_id
    and profile_id is null;

  update public.match_players
  set profile_id = p_profile_id
  where padel_player_id = p_padel_player_id
    and profile_id is null;
end;
$body$;

grant execute on function public.link_padel_player_to_profile(uuid, uuid) to authenticated;
