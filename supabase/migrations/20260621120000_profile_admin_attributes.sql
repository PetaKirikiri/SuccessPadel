-- Admin-managed player attributes: gender, dominant hand, skill level.

alter table public.profiles
  add column if not exists gender text,
  add column if not exists dominant_hand text,
  add column if not exists skill_level text;

alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('Male', 'Female'));

alter table public.profiles
  drop constraint if exists profiles_dominant_hand_check;

alter table public.profiles
  add constraint profiles_dominant_hand_check
  check (dominant_hand is null or dominant_hand in ('left', 'right'));

alter table public.profiles
  drop constraint if exists profiles_skill_level_check;

alter table public.profiles
  add constraint profiles_skill_level_check
  check (
    skill_level is null
    or skill_level in ('Beginner', 'Low Inter', 'Intermediate', 'Advanced', 'Open')
  );

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
    'line_user_id', p.line_user_id
  )
  from public.profiles p
  where p.id = p_profile_id;
$$;
