-- Link a guest padel_player to a profile via LINE (no QR link_token) — used from player profile handshake in LINE.

create or replace function public.link_padel_player_direct(
  p_padel_player_id uuid,
  p_profile_id uuid,
  p_line_user_id text,
  p_line_display_name text,
  p_line_picture_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if not public.padel_player_still_linkable(p_padel_player_id) then
    raise exception 'Player not found or already linked';
  end if;

  update public.profiles p
  set
    line_user_id = p_line_user_id,
    display_name = coalesce(nullif(btrim(p_line_display_name), ''), p.display_name),
    avatar_url = coalesce(p_line_picture_url, p.avatar_url)
  where p.id = p_profile_id;

  update public.padel_players pp
  set
    profile_id = p_profile_id,
    line_user_id = p_line_user_id,
    line_display_name = p_line_display_name,
    line_picture_url = p_line_picture_url,
    linked_at = now(),
    updated_at = now()
  where pp.id = p_padel_player_id
    and (pp.profile_id is null or pp.profile_id = p_profile_id)
    and (pp.line_user_id is null or btrim(pp.line_user_id) = '');

  if not found then
    raise exception 'Player not found or already linked';
  end if;

  update public.session_players sp
  set profile_id = p_profile_id, guest_name = null, padel_player_id = p_padel_player_id
  where sp.padel_player_id = p_padel_player_id
    and (sp.profile_id is null or sp.profile_id = p_profile_id);

  update public.match_players mp
  set profile_id = p_profile_id
  where mp.padel_player_id = p_padel_player_id
    and (mp.profile_id is null or mp.profile_id = p_profile_id);
end;
$body$;

revoke all on function public.link_padel_player_direct(uuid, uuid, text, text, text) from public;
