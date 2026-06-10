-- Test today session: rename guest player G → Mac in roster and saved court logs.

UPDATE public.friendly_sessions
SET players = (
  SELECT coalesce(
    jsonb_agg(
      CASE WHEN elem::text = '"G"' THEN to_jsonb('Mac'::text) ELSE elem END
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(players) WITH ORDINALITY AS t(elem, ord)
)
WHERE id = '0a331c9e-798c-44a9-9eb3-f05b7637fdb3';

UPDATE public.match_gesture_logs
SET roster = (
  SELECT coalesce(
    jsonb_agg(
      CASE
        WHEN slot->>'name' = 'G' THEN jsonb_set(slot, '{name}', '"Mac"'::jsonb)
        ELSE slot
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(roster) AS slot
)
WHERE friendly_session_id = '0a331c9e-798c-44a9-9eb3-f05b7637fdb3';
