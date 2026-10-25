-- One-time owner-requested classification; subsequent manual edits remain authoritative.
-- Save profiles/padel_players residency values before running. No schedule or score writes.
begin;
create temporary table residency_seed on commit drop as
with recent_players as (
  select distinct coalesce(pp.profile_id, mp.profile_id, sp.profile_id, pp.id, sp.padel_player_id) as id
  from public.game_sessions s
  join public.matches m on m.session_id = s.id
  join public.match_players mp on mp.match_id = m.id
  left join public.session_players sp on sp.id = mp.roster_entry_id
  left join public.padel_players pp on pp.id = coalesce(mp.padel_player_id, sp.padel_player_id)
  where s.game_kind = 'competition'
    and s.starts_at >= now() - interval '3 months'
    and s.ends_at < now()
    and m.score_summary ~ '^[0-9]+[[:space:]]*-[[:space:]]*[0-9]+$'
)
select d.id, d.residency_status as previous_status,
  case when r.id is not null then 'local' else 'holiday' end as residency_status
from public.owner_member_directory_data d
left join recent_players r using (id);

insert into public.member_directory_edit_log(member_id, patch, previous_values)
select id,
  jsonb_build_object('residency_status', residency_status,
    'source', 'owner_requested_competition_history_seed',
    'window_start', now() - interval '3 months', 'window_end', now()),
  jsonb_build_object('residency_status', previous_status)
from residency_seed where previous_status is distinct from residency_status;

update public.profiles p set residency_status = seed.residency_status
from residency_seed seed
where p.id = seed.id and p.residency_status is distinct from seed.residency_status;

update public.padel_players pp set residency_status = seed.residency_status
from residency_seed seed
where coalesce(pp.profile_id, pp.id) = seed.id
  and pp.residency_status is distinct from seed.residency_status;

do $$ begin
  if exists (
    select 1 from residency_seed seed join public.owner_member_directory_data d using (id)
    where d.residency_status is distinct from seed.residency_status
  ) then raise exception 'Residency verification failed'; end if;
end $$;
commit;

select residency_status, count(*) as players
from public.owner_member_directory_data group by residency_status order by residency_status;
