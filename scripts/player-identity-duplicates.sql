-- Player identity fork detection (resolved display name).
-- Run against local or remote: psql … -f scripts/player-identity-duplicates.sql
-- Or paste into Supabase SQL editor.

-- 1) Duplicate groups by resolved name (profile name wins over padel_players name)
with resolved as (
  select
    pp.id as padel_player_id,
    pp.display_name as padel_player_name,
    pp.profile_id as padel_profile_id,
    pp.line_user_id as padel_line_user_id,
    pp.linked_at,
    pp.created_at,
    p.id as profile_id,
    p.display_name as profile_name,
    p.avatar_url,
    p.line_user_id as profile_line_user_id,
    coalesce(p.display_name, pp.display_name) as resolved_name
  from public.padel_players pp
  left join public.profiles p on p.id = pp.profile_id
  where coalesce(p.display_name, pp.display_name) is not null
    and trim(coalesce(p.display_name, pp.display_name)) <> ''
)
select
  lower(regexp_replace(trim(resolved_name), '\s+', ' ', 'g')) as normalized_name,
  count(*) as fork_count,
  jsonb_agg(
    jsonb_build_object(
      'padel_player_id', padel_player_id,
      'padel_player_name', padel_player_name,
      'padel_profile_id', padel_profile_id,
      'profile_id', profile_id,
      'profile_name', profile_name,
      'avatar_url', avatar_url,
      'line_user_id', coalesce(profile_line_user_id, padel_line_user_id),
      'linked_at', linked_at,
      'created_at', created_at,
      'session_players', (
        select count(*)::int from public.session_players sp where sp.padel_player_id = resolved.padel_player_id
      ),
      'match_players', (
        select count(*)::int from public.match_players mp where mp.padel_player_id = resolved.padel_player_id
      )
    )
    order by created_at
  ) as records
from resolved
group by lower(regexp_replace(trim(resolved_name), '\s+', ' ', 'g'))
having count(*) > 1
order by fork_count desc, normalized_name;

-- 2) Reference counts for a specific fork (edit UUIDs)
-- select public.padel_player_reference_counts('PADEL_PLAYER_ID'::uuid);

-- 3) Suggested dominant per group (highest dominance score)
-- select * from public.list_player_identity_fork_groups();

-- 4) Dry-run merge (admin RPC) — replace UUIDs before running
-- select public.preview_merge_padel_players(
--   'DOMINANT_PADEL_PLAYER_ID'::uuid,
--   array['ABSORB_ID_1'::uuid, 'ABSORB_ID_2'::uuid]
-- );

-- 5) Execute merge only after preview looks correct (admin RPC)
-- select public.merge_padel_players_into_dominant(
--   'DOMINANT_PADEL_PLAYER_ID'::uuid,
--   array['ABSORB_ID_1'::uuid, 'ABSORB_ID_2'::uuid]
-- );
