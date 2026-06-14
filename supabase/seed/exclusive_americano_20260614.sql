-- Exclusive Americano · Sunday 14 Jun 2026 · 12 players · 3 courts · 7:03–9:00 PM (2h, 3 min buffer at start)
-- Session: f14e06aa-0614-4000-8000-000000000012

insert into public.game_sessions (
  id,
  season_id,
  title,
  starts_on,
  ends_on,
  starts_at,
  ends_at,
  status,
  game_kind,
  visibility,
  skill_level,
  gender,
  rules,
  target_players,
  max_players,
  player_cap_mode,
  partnership_mode,
  scoring_preset,
  scoring_config,
  who_can_log_matches,
  margin_bonus_enabled,
  created_by
) values (
  'f14e06aa-0614-4000-8000-000000000012',
  '954afde7-f952-4ef9-ab72-ad85eddd3dff',
  'Exclusive Americano Match',
  '2026-06-14',
  '2026-06-14',
  '2026-06-14T19:03:00+07:00',
  '2026-06-14T21:00:00+07:00',
  'open',
  'competition',
  'open',
  'Advanced',
  'Men',
  'Americano · 6 games · 400 THB',
  12,
  12,
  'strict',
  'americano',
  'standard',
  $sc${"americano_target":6,"americano_unit":"games","americano_games":7,"break_minutes":2,"game_minutes":15,"schedule_seed":0,"schedule_version":10}$sc$::jsonb,
  'roster_members',
  true,
  '7bdc33ac-7f21-4ebf-bfbf-343080724890'
)
on conflict (id) do update set
  title = excluded.title,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  skill_level = excluded.skill_level,
  gender = excluded.gender,
  rules = excluded.rules,
  target_players = excluded.target_players,
  max_players = excluded.max_players,
  scoring_config = excluded.scoring_config;

delete from public.session_players where session_id = 'f14e06aa-0614-4000-8000-000000000012';

insert into public.session_players (session_id, profile_id, guest_name, rank_order) values
  ('f14e06aa-0614-4000-8000-000000000012', null, 'José', 0),
  ('f14e06aa-0614-4000-8000-000000000012', null, 'Matt', 1),
  ('f14e06aa-0614-4000-8000-000000000012', null, 'Alex', 2),
  ('f14e06aa-0614-4000-8000-000000000012', 'f6a9bd6f-fe8e-4c2e-b769-0f1e70a0351d', null, 3),
  ('f14e06aa-0614-4000-8000-000000000012', null, 'Daniel', 4),
  ('f14e06aa-0614-4000-8000-000000000012', '0a69a58a-3107-48f6-b220-99940da5c868', null, 5),
  ('f14e06aa-0614-4000-8000-000000000012', null, 'Tommy', 6),
  ('f14e06aa-0614-4000-8000-000000000012', null, 'Poom', 7),
  ('f14e06aa-0614-4000-8000-000000000012', 'e7e03eb1-6879-4a73-8d81-c277d1b41fbf', null, 8),
  ('f14e06aa-0614-4000-8000-000000000012', null, 'Josh', 9),
  ('f14e06aa-0614-4000-8000-000000000012', '35d43096-91ee-4e4a-8bfd-2b1901e99e54', null, 10),
  ('f14e06aa-0614-4000-8000-000000000012', null, 'Ruslan', 11);
