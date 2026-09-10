-- Once a competition is running, preserve the roster positions and the complete
-- player-to-court schedule. Score entry and round status updates remain allowed.

create or replace function public.prevent_started_competition_roster_structure_change()
returns trigger
language plpgsql
set search_path = public
as $body$
declare
  v_session_id uuid := case when tg_op = 'INSERT' then new.session_id else old.session_id end;
begin
  if exists (
    select 1
    from public.game_sessions gs
    where gs.id = v_session_id
      and gs.game_kind = 'competition'
      and gs.competition_started_at is not null
  ) then
    raise exception 'Started competition roster positions are locked';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$body$;

drop trigger if exists protect_started_competition_roster_structure on public.session_players;
create trigger protect_started_competition_roster_structure
before insert or delete or update of session_id, rank_order on public.session_players
for each row execute function public.prevent_started_competition_roster_structure_change();

create or replace function public.prevent_started_competition_round_structure_change()
returns trigger
language plpgsql
set search_path = public
as $body$
declare
  v_session_id uuid := case when tg_op = 'INSERT' then new.session_id else old.session_id end;
begin
  if exists (
    select 1
    from public.game_sessions gs
    where gs.id = v_session_id
      and gs.game_kind = 'competition'
      and gs.competition_started_at is not null
  ) then
    raise exception 'Started competition round schedule is locked';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$body$;

drop trigger if exists protect_started_competition_round_structure on public.competition_rounds;
create trigger protect_started_competition_round_structure
before insert or delete or update of session_id, round_number, is_final, starts_at, ends_at
on public.competition_rounds
for each row execute function public.prevent_started_competition_round_structure_change();

create or replace function public.prevent_started_competition_court_assignment_change()
returns trigger
language plpgsql
set search_path = public
as $body$
declare
  v_round_id uuid := case when tg_op = 'INSERT' then new.round_id else old.round_id end;
begin
  if exists (
    select 1
    from public.competition_rounds cr
    join public.game_sessions gs on gs.id = cr.session_id
    where cr.id = v_round_id
      and gs.game_kind = 'competition'
      and gs.competition_started_at is not null
  ) then
    raise exception 'Started competition court assignments are locked';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$body$;

drop trigger if exists protect_started_competition_court_assignments on public.competition_round_players;
create trigger protect_started_competition_court_assignments
before insert or delete or update of round_id, court_id, profile_id, roster_entry_id, team
on public.competition_round_players
for each row execute function public.prevent_started_competition_court_assignment_change();
