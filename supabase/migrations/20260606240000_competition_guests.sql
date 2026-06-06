-- Guest players on competition rosters (name only, no member profile).

alter table public.session_players
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists guest_name text;

update public.session_players set id = gen_random_uuid() where id is null;
alter table public.session_players alter column id set default gen_random_uuid();
alter table public.session_players alter column id set not null;

alter table public.session_players drop constraint if exists session_players_pkey;
alter table public.session_players add primary key (id);

alter table public.session_players alter column profile_id drop not null;

alter table public.session_players drop constraint if exists session_players_member_or_guest;
alter table public.session_players add constraint session_players_member_or_guest check (
  (profile_id is not null and guest_name is null)
  or (profile_id is null and guest_name is not null and btrim(guest_name) <> '')
);

create unique index if not exists session_players_session_profile_uniq
  on public.session_players (session_id, profile_id)
  where profile_id is not null;

alter table public.competition_round_players
  add column if not exists roster_entry_id uuid references public.session_players (id) on delete cascade;

update public.competition_round_players crp
set roster_entry_id = sp.id
from public.competition_rounds cr, public.session_players sp
where cr.id = crp.round_id
  and sp.session_id = cr.session_id
  and sp.profile_id = crp.profile_id
  and crp.roster_entry_id is null;

alter table public.competition_round_players drop constraint if exists competition_round_players_pkey;
alter table public.competition_round_players alter column profile_id drop not null;
alter table public.competition_round_players add primary key (round_id, roster_entry_id);

alter table public.competition_round_players drop constraint if exists competition_round_players_entry_check;
alter table public.competition_round_players add constraint competition_round_players_entry_check check (
  roster_entry_id is not null
);

create or replace function public.join_competition(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.game_sessions
    where id = p_session_id and game_kind = 'competition'
  ) then
    raise exception 'Not a competition';
  end if;

  if not public.can_join_session(p_session_id) then
    raise exception 'Competition is full or closed';
  end if;

  if exists (
    select 1 from public.session_players
    where session_id = p_session_id and profile_id = auth.uid()
  ) then
    return;
  end if;

  insert into public.session_players (session_id, profile_id)
  values (p_session_id, auth.uid());
end;
$body$;

create or replace function public.add_competition_guest(p_session_id uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_session public.game_sessions%rowtype;
  v_name text;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  v_name := btrim(p_display_name);
  if v_name = '' then
    raise exception 'Name required';
  end if;

  select * into v_session from public.game_sessions where id = p_session_id;
  if not found or v_session.game_kind <> 'competition' then
    raise exception 'Not a competition';
  end if;
  if v_session.status <> 'open' or v_session.competition_started_at is not null then
    raise exception 'Sign-ups are closed';
  end if;
  if not public.can_join_session(p_session_id) then
    raise exception 'Competition is full';
  end if;

  insert into public.session_players (session_id, guest_name)
  values (p_session_id, v_name)
  returning id into v_id;

  return v_id;
end;
$body$;

create or replace function public.remove_competition_guest(p_roster_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_row public.session_players%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select sp.* into v_row
  from public.session_players sp
  where sp.id = p_roster_id;

  if not found or v_row.guest_name is null then
    raise exception 'Guest not found';
  end if;

  if exists (
    select 1 from public.game_sessions gs
    where gs.id = v_row.session_id
      and (gs.status <> 'open' or gs.competition_started_at is not null)
  ) then
    raise exception 'Sign-ups are closed';
  end if;

  delete from public.session_players where id = p_roster_id;
end;
$body$;

create or replace function public.assign_competition_round(p_round_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_entries uuid[];
  v_courts uuid[];
  v_court_idx int := 1;
  v_batch uuid[];
  v_shuffled uuid[];
  v_court_id uuid;
  v_i int;
begin
  delete from public.competition_round_players where round_id = p_round_id;

  select coalesce(array_agg(sp.id order by random()), '{}')
  into v_entries
  from public.session_players sp
  where sp.session_id = p_session_id;

  select coalesce(array_agg(c.id order by c.sort_order), '{}')
  into v_courts
  from public.courts c
  where c.is_active;

  if coalesce(array_length(v_courts, 1), 0) = 0 then
    raise exception 'No active courts';
  end if;

  while coalesce(array_length(v_entries, 1), 0) >= 4 loop
    v_batch := v_entries[1:4];
    v_entries := v_entries[5:coalesce(array_length(v_entries, 1), 0)];

    select coalesce(array_agg(x order by random()), '{}')
    into v_shuffled
    from unnest(v_batch) as x;

    v_court_id := v_courts[v_court_idx];
    v_court_idx := v_court_idx + 1;
    if v_court_idx > coalesce(array_length(v_courts, 1), 0) then
      v_court_idx := 1;
    end if;

    for v_i in 1..2 loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'a'
      from public.session_players sp
      where sp.id = v_shuffled[v_i];
    end loop;
    for v_i in 3..4 loop
      insert into public.competition_round_players (round_id, court_id, roster_entry_id, profile_id, team)
      select p_round_id, v_court_id, sp.id, sp.profile_id, 'b'
      from public.session_players sp
      where sp.id = v_shuffled[v_i];
    end loop;
  end loop;
end;
$body$;

grant execute on function public.add_competition_guest(uuid, text) to authenticated;
grant execute on function public.remove_competition_guest(uuid) to authenticated;
