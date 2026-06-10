-- Reset "LineTestt." → "Test development game" (endless gesture-log test pad).
-- Session: fdf299d9-ef2d-4d68-8274-be59308c8568

DELETE FROM public.match_gesture_logs
WHERE friendly_session_id = 'fdf299d9-ef2d-4d68-8274-be59308c8568'
   OR court_setup_key = 'fdf299d9-ef2d-4d68-8274-be59308c8568';

UPDATE public.friendly_sessions
SET
  title = 'Test development game',
  status = 'ready',
  play_mode = 'free',
  visibility = 'public',
  players = '["Peta", "Boon", "Sunny", "Bia"]'::jsonb,
  profile_ids = '[
    "7bdc33ac-7f21-4ebf-bfbf-343080724890",
    "6778b3f3-2583-472c-ae02-77780e01f4f1",
    "209306fc-a95d-4767-8300-b756fee12d36",
    "f5384b42-d681-4b49-90aa-926d6f34e1f4"
  ]'::jsonb,
  profile_avatars = (
    SELECT coalesce(jsonb_agg(p.avatar_url ORDER BY ord), '[]'::jsonb)
    FROM (
      VALUES
        (0, '7bdc33ac-7f21-4ebf-bfbf-343080724890'::uuid),
        (1, '6778b3f3-2583-472c-ae02-77780e01f4f1'::uuid),
        (2, '209306fc-a95d-4767-8300-b756fee12d36'::uuid),
        (3, 'f5384b42-d681-4b49-90aa-926d6f34e1f4'::uuid)
    ) AS slots(ord, pid)
    LEFT JOIN public.profiles p ON p.id = slots.pid
  ),
  organized_config = jsonb_build_object(
    'endless', true,
    'padResetAt', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
WHERE id = 'fdf299d9-ef2d-4d68-8274-be59308c8568';
