-- Expose linked status only, never the private LINE identifier.
create or replace view public.public_member_directory
with (security_barrier = true) as
with members as (
  select p.id, p.display_name, p.avatar_url, p.gender, p.skill_level, p.court_member,
    (nullif(btrim(p.line_user_id), '') is not null or exists (
      select 1 from public.padel_players linked where linked.profile_id = p.id
        and nullif(btrim(linked.line_user_id), '') is not null
    )) as has_line_account
  from public.profiles p
  union all
  select pp.id, pp.display_name, pp.line_picture_url, pp.gender, pp.skill_level, pp.court_member,
    nullif(btrim(pp.line_user_id), '') is not null as has_line_account
  from public.padel_players pp where pp.profile_id is null
)
select members.id, members.display_name, members.avatar_url, members.gender,
  members.skill_level, coalesce(history.levels, array[]::text[]) as history_levels, members.court_member, members.has_line_account
from members
left join lateral (
  select array_agg(recent.skill_level order by recent.starts_at desc) as levels
  from (
    select s.id, s.skill_level, s.starts_at
    from public.game_sessions s
    where s.game_kind = 'competition' and s.ends_at < now()
      and s.skill_level is not null
      and exists (
        select 1 from public.matches m
        join public.match_players mp on mp.match_id = m.id
        join public.padel_players pp on pp.id = mp.padel_player_id
        where m.session_id = s.id and m.score_summary ~ '^[0-9]+[[:space:]]*-[[:space:]]*[0-9]+$'
          and (pp.id = members.id or pp.profile_id = members.id)
      )
    order by s.starts_at desc limit 5
  ) recent
) history on true;

notify pgrst, 'reload schema';
