alter table public.padel_players
  add column if not exists skill_level text;

alter table public.padel_players
  drop constraint if exists padel_players_skill_level_check;

alter table public.padel_players
  add constraint padel_players_skill_level_check
  check (
    skill_level is null
    or skill_level in ('Beginner', 'Low Inter', 'Intermediate', 'Advanced', 'Open')
  );

update public.padel_players pp
set skill_level = p.skill_level
from public.profiles p
where pp.profile_id = p.id
  and pp.skill_level is distinct from p.skill_level;

create or replace function public.sync_profile_skill_level_to_padel_player()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.padel_players
  set skill_level = new.skill_level,
      updated_at = now()
  where profile_id = new.id
    and skill_level is distinct from new.skill_level;
  return new;
end;
$$;

drop trigger if exists sync_profile_skill_level_to_padel_player on public.profiles;
create trigger sync_profile_skill_level_to_padel_player
  after update of skill_level on public.profiles
  for each row
  when (old.skill_level is distinct from new.skill_level)
  execute function public.sync_profile_skill_level_to_padel_player();

create or replace function public.admin_set_player_skill_level(
  p_padel_player_id uuid default null,
  p_profile_id uuid default null,
  p_skill_level text default null
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_level text := nullif(btrim(p_skill_level), '');
  v_padel_player_id uuid := p_padel_player_id;
  v_profile_id uuid := p_profile_id;
  v_linked_profile_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if v_level is not null
     and v_level not in ('Beginner', 'Low Inter', 'Intermediate', 'Advanced', 'Open') then
    raise exception 'Invalid skill level';
  end if;

  if v_padel_player_id is null and v_profile_id is null then
    raise exception 'Player id required';
  end if;

  if v_padel_player_id is null then
    select id
    into v_padel_player_id
    from public.padel_players
    where profile_id = v_profile_id;

    if v_padel_player_id is null then
      insert into public.padel_players (display_name, profile_id, linked_at, skill_level)
      select p.display_name, p.id, now(), v_level
      from public.profiles p
      where p.id = v_profile_id
      returning id into v_padel_player_id;

      if v_padel_player_id is null then
        raise exception 'Player not found';
      end if;
    end if;
  end if;

  select profile_id
  into v_linked_profile_id
  from public.padel_players
  where id = v_padel_player_id;

  if not found then
    raise exception 'Player not found';
  end if;

  if v_profile_id is not null
     and v_linked_profile_id is not null
     and v_profile_id is distinct from v_linked_profile_id then
    raise exception 'Player identity mismatch';
  end if;

  v_profile_id := coalesce(v_profile_id, v_linked_profile_id);

  update public.padel_players
  set skill_level = v_level,
      updated_at = now()
  where id = v_padel_player_id;

  if v_profile_id is not null then
    update public.profiles
    set skill_level = v_level
    where id = v_profile_id;
  end if;

  return v_level;
end;
$$;

revoke all on function public.admin_set_player_skill_level(uuid, uuid, text) from public;
grant execute on function public.admin_set_player_skill_level(uuid, uuid, text) to authenticated;
