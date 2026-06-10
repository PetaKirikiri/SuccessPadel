create or replace function public.update_friendly_session(
  p_id uuid,
  p_title text,
  p_visibility text,
  p_play_mode text,
  p_players jsonb,
  p_profile_ids jsonb,
  p_profile_avatars jsonb,
  p_organized_config jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_visibility not in ('public', 'private') then
    raise exception 'Invalid visibility';
  end if;
  if p_play_mode not in ('free', 'organized') then
    raise exception 'Invalid play mode';
  end if;

  update public.friendly_sessions
  set
    title = coalesce(nullif(btrim(p_title), ''), title),
    visibility = p_visibility,
    play_mode = p_play_mode,
    players = coalesce(p_players, '[]'::jsonb),
    profile_ids = coalesce(p_profile_ids, '[]'::jsonb),
    profile_avatars = coalesce(p_profile_avatars, '[]'::jsonb),
    organized_config = p_organized_config
  where id = p_id;

  if not found then
    raise exception 'Friendly game not found';
  end if;
end;
$body$;

grant execute on function public.update_friendly_session(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;

drop function if exists public.update_friendly_session_config(uuid, jsonb);
