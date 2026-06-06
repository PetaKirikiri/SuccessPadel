-- Player profile details (racket, style, availability, etc.).

create type public.play_side as enum ('left', 'right', 'both');

alter table public.profiles
  add column if not exists racket text,
  add column if not exists play_style text,
  add column if not exists preferred_side public.play_side,
  add column if not exists enjoys_fun_games boolean not null default false,
  add column if not exists usually_free text;
