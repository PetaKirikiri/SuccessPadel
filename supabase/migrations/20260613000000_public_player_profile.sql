-- Public read-only player profile for profile pages (no auth required).

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
    'created_at', p.created_at
  )
  from public.profiles p
  where p.id = p_profile_id;
$$;

revoke all on function public.get_player_profile(uuid) from public;
grant execute on function public.get_player_profile(uuid) to anon, authenticated;
