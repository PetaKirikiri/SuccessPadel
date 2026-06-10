-- "Test today" — Wed 10 Jun, 18:00–20:00 court hire. Warm-up 18:00–18:04, game 1 at 18:04, game 7 ends 20:00.
-- Session: 0a331c9e-798c-44a9-9eb3-f05b7637fdb3

UPDATE public.friendly_sessions
SET
  organized_config = coalesce(organized_config, '{}'::jsonb) || jsonb_build_object(
    'day', '2026-06-10',
    'startHour', 18,
    'startMinute', 4,
    'ruleFormat', 'americano',
    'partnerStyle', 'swapped',
    'americanoScoring', 6,
    'gameCount', 7,
    'gameMinutes', 14,
    'breakMinutes', 3,
    'previewSeed', 0
  )
WHERE id = '0a331c9e-798c-44a9-9eb3-f05b7637fdb3';
