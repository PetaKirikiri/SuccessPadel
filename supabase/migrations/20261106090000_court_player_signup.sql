-- Only expose eligibility for real roster entries at public competitions.
create or replace function public.competition_signup_slots(p_session_id uuid)
returns table(roster_id uuid) language sql stable security definer set search_path = '' as $$
  select sp.id from public.session_players sp
  join public.game_sessions g on g.id = sp.session_id
  left join public.padel_players pp on pp.id = sp.padel_player_id
    or (sp.padel_player_id is null and pp.profile_id = sp.profile_id)
  left join public.profiles p on p.id = coalesce(sp.profile_id, pp.profile_id)
  where g.id = p_session_id and g.game_kind = 'competition' and g.visibility = 'open'
    and (p.id is not null or pp.id is not null or nullif(trim(sp.guest_name),'') is not null)
    and nullif(trim(p.line_user_id),'') is null and nullif(trim(pp.line_user_id),'') is null
    and (pp.id is null or public.padel_player_still_linkable(pp.id))
$$;

-- Resolve by roster primary key. Concurrent scans of one guest reuse one identity.
create or replace function public.court_signup_player(p_session_id uuid,p_roster_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare slot public.session_players%rowtype; player_id uuid;
begin
  select * into slot from public.session_players where id=p_roster_id and session_id=p_session_id for update;
  if not found or not exists(select from public.competition_signup_slots(p_session_id) where roster_id=p_roster_id) then
    raise exception 'This player is unavailable for signup';
  end if;
  player_id := slot.padel_player_id;
  if player_id is null then
    if slot.profile_id is not null then
      player_id := public.ensure_linkable_padel_player(slot.profile_id);
    else
      insert into public.padel_players(display_name) values(slot.guest_name) returning id into player_id;
    end if;
    if player_id is null then raise exception 'Player already linked'; end if;
    update public.session_players set padel_player_id=player_id where id=slot.id;
  end if;
  return player_id;
end $$;
revoke all on function public.competition_signup_slots(uuid), public.court_signup_player(uuid,uuid) from public;
grant execute on function public.competition_signup_slots(uuid), public.court_signup_player(uuid,uuid) to anon, authenticated;
