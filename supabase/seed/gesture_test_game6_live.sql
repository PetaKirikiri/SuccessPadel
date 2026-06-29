-- Gesture test session — game 6 live now, 100 min per game (Bangkok wall clock).
-- Session: 7b44b757-8d8f-40fd-9952-cf6570f3cd40
-- For full roster reset (16 slots → 4 courts), run gesture_test_session.sql first.
-- Re-run anytime to re-anchor game 6 ~8 min into the slot (~92 min left on the clock).

WITH start_local AS (
  SELECT (now() AT TIME ZONE 'Asia/Bangkok' - interval '528 minutes') AS s
)
UPDATE public.friendly_sessions
SET
  organized_config = coalesce(organized_config, '{}'::jsonb) || jsonb_build_object(
    'day', to_char((SELECT s FROM start_local), 'YYYY-MM-DD'),
    'startHour', extract(hour FROM (SELECT s FROM start_local))::int,
    'startMinute', extract(minute FROM (SELECT s FROM start_local))::int,
    'gameMinutes', 100,
    'gameCount', 6,
    'breakMinutes', 4,
    'sessionEndHour', 23,
    'sessionEndMinute', 59
  )
WHERE id = '7b44b757-8d8f-40fd-9952-cf6570f3cd40';
