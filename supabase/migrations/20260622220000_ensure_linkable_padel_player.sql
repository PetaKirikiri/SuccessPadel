-- Ensure share/profile links can resolve a padel_players row for LINE setup
-- (guest padel or profile without LINE).

create or replace function public.ensure_linkable_padel_player(p_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_padel_id uuid;
  v_profile public.profiles%rowtype;
begin
  select pp.id into v_padel_id
  from public.padel_players pp
  where pp.id = p_player_id
    and pp.line_user_id is null
    and (
      pp.profile_id is null
      or exists (
        select 1
        from public.profiles p
        where p.id = pp.profile_id
          and p.line_user_id is null
      )
    );

  if found then
    return v_padel_id;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_player_id
    and line_user_id is null;

  if not found then
    return null;
  end if;

  select id into v_padel_id
  from public.padel_players
  where profile_id = p_player_id
  limit 1;

  if v_padel_id is not null then
    return v_padel_id;
  end if;

  insert into public.padel_players (display_name, profile_id, linked_at)
  values (v_profile.display_name, p_player_id, now())
  returning id into v_padel_id;

  return v_padel_id;
end;
$body$;

revoke all on function public.ensure_linkable_padel_player(uuid) from public;
grant execute on function public.ensure_linkable_padel_player(uuid) to anon, authenticated;
