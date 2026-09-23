-- Success Padel's agreed club levels. These are not an external federation rating.
-- Keep Intermediate as the storage key so existing clients and historical filters work.
create table public.padel_skill_levels (
  code text primary key,
  rank smallint not null unique check (rank between 1 and 6),
  name text not null unique,
  storage_value text not null unique
);
insert into public.padel_skill_levels(code, rank, name, storage_value) values
 ('beginner',1,'Beginner','Beginner'),
 ('low_inter',2,'Low Inter','Low Inter'),
 ('inter',3,'Inter','Intermediate'),
 ('high_inter',4,'High Inter','High Inter'),
 ('advanced',5,'Advanced','Advanced'),
 ('advanced_plus',6,'Advanced Plus','Advanced Plus');

alter table public.padel_skill_levels enable row level security;
revoke all on public.padel_skill_levels from public, anon, authenticated;
grant select on public.padel_skill_levels to anon, authenticated;
grant all on public.padel_skill_levels to service_role;
create policy skill_levels_read on public.padel_skill_levels for select to anon, authenticated using (true);

-- Guide copy and artwork can evolve without changing a player's assigned level.
create table public.padel_skill_level_guides (
  level_code text not null references public.padel_skill_levels(code),
  locale text not null check (locale in ('en','th','fr','ru','he')),
  summary text,
  self_checks jsonb not null default '[]'::jsonb check (jsonb_typeof(self_checks)='array'),
  next_level_focus text,
  image_url text,
  image_alt text,
  status text not null default 'draft' check (status in ('draft','published')),
  updated_at timestamptz not null default now(),
  primary key (level_code,locale),
  constraint skill_guide_publish_ready check (status='draft' or (
    nullif(btrim(summary),'') is not null and jsonb_array_length(self_checks)>0
    and nullif(btrim(image_url),'') is not null and nullif(btrim(image_alt),'') is not null
  ))
);
alter table public.padel_skill_level_guides enable row level security;
revoke all on public.padel_skill_level_guides from public, anon, authenticated;
grant select on public.padel_skill_level_guides to anon, authenticated;
grant insert, update, delete on public.padel_skill_level_guides to authenticated;
grant all on public.padel_skill_level_guides to service_role;
create policy skill_guides_published_read on public.padel_skill_level_guides
 for select to anon, authenticated using (status='published');
create policy skill_guides_admin on public.padel_skill_level_guides
 for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Blank drafts intentionally await the educational design and approved images.
insert into public.padel_skill_level_guides(level_code,locale)
 select code,'en' from public.padel_skill_levels;

alter table public.profiles drop constraint if exists profiles_skill_level_check;
alter table public.profiles add constraint profiles_skill_level_catalog_fk
 foreign key (skill_level) references public.padel_skill_levels(storage_value);
create index if not exists profiles_skill_level_idx on public.profiles(skill_level) where skill_level is not null;

alter table public.padel_players add column if not exists skill_level text;
alter table public.padel_players drop constraint if exists padel_players_skill_level_check;
alter table public.padel_players add constraint padel_players_skill_level_catalog_fk
 foreign key (skill_level) references public.padel_skill_levels(storage_value);
create index if not exists padel_players_skill_level_idx on public.padel_players(skill_level) where skill_level is not null;

create or replace function public.normalize_padel_skill_level()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.skill_level='Inter' then new.skill_level:='Intermediate'; end if;
 return new;
end $$;
revoke all on function public.normalize_padel_skill_level() from public,anon,authenticated;
create trigger normalize_profile_skill_level before insert or update of skill_level on public.profiles
 for each row execute function public.normalize_padel_skill_level();
create trigger normalize_registry_skill_level before insert or update of skill_level on public.padel_players
 for each row execute function public.normalize_padel_skill_level();

-- A linked profile remains authoritative; registry-only guests can have a level too.
-- Read paths should prefer profiles.skill_level when a player has a linked profile.
comment on column public.padel_players.skill_level is 'Club ability for unlinked players; linked profiles.skill_level is authoritative.';

-- Open remains an event admission option, never a seventh player ability level.
alter table public.game_sessions add constraint game_sessions_skill_level_catalog_check
 check (skill_level is null or skill_level in ('Beginner','Low Inter','Intermediate','High Inter','Advanced','Advanced Plus','Open'));
create trigger normalize_session_skill_level before insert or update of skill_level on public.game_sessions
 for each row execute function public.normalize_padel_skill_level();

alter table public.game_sessions
 add column skill_level_min_rank smallint references public.padel_skill_levels(rank),
 add column skill_level_max_rank smallint references public.padel_skill_levels(rank),
 add constraint game_sessions_skill_level_range_check check (
  (skill_level_min_rank is null and skill_level_max_rank is null) or
  (skill_level_min_rank is not null and skill_level_max_rank is not null and skill_level_min_rank<=skill_level_max_rank)
 );
create index game_sessions_skill_level_min_idx on public.game_sessions(skill_level_min_rank) where skill_level_min_rank is not null;
create index game_sessions_skill_level_max_idx on public.game_sessions(skill_level_max_rank) where skill_level_max_rank is not null;
comment on column public.game_sessions.skill_level_min_rank is 'Optional explicit minimum ability. NULL with maximum NULL means legacy single skill_level applies; Open means unrestricted.';
comment on column public.game_sessions.skill_level_max_rank is 'Optional explicit maximum ability; use together with skill_level_min_rank.';

notify pgrst,'reload schema';
