-- Player country / origin shown on public profile pages.

alter table public.profiles
  add column if not exists country text;

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
    'avatar_url', public.resolved_profile_avatar_url(p.avatar_mode, p.avatar_url, p.pixel_avatar_url),
    'avatar_mode', p.avatar_mode,
    'pixel_avatar', p.pixel_avatar,
    'pixel_avatar_url', p.pixel_avatar_url,
    'playtomic_number', p.playtomic_number,
    'country', p.country,
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

notify pgrst, 'reload schema';
