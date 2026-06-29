-- Gesture test session — 16 roster slots (Peta + 15 testers) → 4 courts, game 6 live ~100 min.
-- Session: 7b44b757-8d8f-40fd-9952-cf6570f3cd40
-- Re-run to reset roster, clear logs, and re-anchor game 6 timing (Bangkok wall clock).

DELETE FROM public.match_gesture_logs
WHERE friendly_session_id = '7b44b757-8d8f-40fd-9952-cf6570f3cd40'
   OR court_setup_key LIKE '7b44b757-8d8f-40fd-9952-cf6570f3cd40-%';

WITH start_local AS (
  SELECT (now() AT TIME ZONE 'Asia/Bangkok' - interval '528 minutes') AS s
),
player_names AS (
  SELECT jsonb_agg(
    CASE
      WHEN n = 0 THEN 'Peta Kirikiri'
      ELSE 'Tester ' || chr(64 + n)
    END
    ORDER BY n
  ) AS players
  FROM generate_series(0, 15) AS n
),
profile_ids AS (
  SELECT jsonb_agg(
    CASE WHEN n = 0 THEN to_jsonb('7bdc33ac-7f21-4ebf-bfbf-343080724890'::text) ELSE 'null'::jsonb END
    ORDER BY n
  ) AS profile_ids
  FROM generate_series(0, 15) AS n
),
avatars AS (
  SELECT coalesce(
    jsonb_agg(
      CASE WHEN n = 0 THEN to_jsonb(p.avatar_url) ELSE 'null'::jsonb END
      ORDER BY n
    ),
    '[]'::jsonb
  ) AS profile_avatars
  FROM generate_series(0, 15) AS n
  LEFT JOIN public.profiles p ON n = 0 AND p.id = '7bdc33ac-7f21-4ebf-bfbf-343080724890'::uuid
)
UPDATE public.friendly_sessions fs
SET
  title = 'Gesture test · 15p · 4 courts',
  players = (SELECT players FROM player_names),
  profile_ids = (SELECT profile_ids FROM profile_ids),
  profile_avatars = (SELECT profile_avatars FROM avatars),
  organized_config = coalesce(fs.organized_config, '{}'::jsonb) || jsonb_build_object(
    'day', to_char((SELECT s FROM start_local), 'YYYY-MM-DD'),
    'startHour', extract(hour FROM (SELECT s FROM start_local))::int,
    'startMinute', extract(minute FROM (SELECT s FROM start_local))::int,
    'gameMinutes', 100,
    'gameCount', 6,
    'breakMinutes', 4,
    'sessionEndHour', 23,
    'sessionEndMinute', 59,
    'previewSeed', 115
  )
WHERE fs.id = '7b44b757-8d8f-40fd-9952-cf6570f3cd40';
