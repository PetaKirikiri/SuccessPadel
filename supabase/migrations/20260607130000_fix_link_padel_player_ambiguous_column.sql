-- Fix: RETURNS TABLE column padel_player_id shadowed session_players.padel_player_id in WHERE.

create or replace function public.link_padel_player_with_line(
  p_link_token text,
  p_profile_id uuid,
  p_line_user_id text,
  p_line_display_name text,
  p_line_picture_url text
)
returns table (
  competition_id uuid,
  padel_player_id uuid,
  handoff_token text
)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_req public.player_line_link_requests%rowtype;
  v_handoff text := 'lph_' || replace(gen_random_uuid()::text, '-', '');
begin
  select * into v_req
  from public.player_line_link_requests
  where link_token = p_link_token
  for update;

  if not found then
    raise exception 'Invalid link request';
  end if;

  if v_req.used_at is not null then
    raise exception 'Link request already used';
  end if;

  if v_req.expires_at < now() then
    raise exception 'Link request expired';
  end if;

  update public.padel_players pp
  set profile_id = p_profile_id,
      line_user_id = p_line_user_id,
      line_display_name = p_line_display_name,
      line_picture_url = p_line_picture_url,
      linked_at = now(),
      updated_at = now()
  where pp.id = v_req.padel_player_id
    and pp.profile_id is null;

  if not found then
    raise exception 'Player not found or already linked';
  end if;

  update public.session_players sp
  set profile_id = p_profile_id,
      guest_name = null,
      padel_player_id = v_req.padel_player_id
  where sp.padel_player_id = v_req.padel_player_id
    and sp.profile_id is null;

  update public.match_players mp
  set profile_id = p_profile_id
  where mp.padel_player_id = v_req.padel_player_id
    and mp.profile_id is null;

  update public.player_line_link_requests
  set used_at = now()
  where link_token = p_link_token;

  competition_id := v_req.competition_id;
  padel_player_id := v_req.padel_player_id;
  handoff_token := v_handoff;

  return next;
end;
$body$;
