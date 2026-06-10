-- Demo game log for "Score Tracking Test" — sample data for court owner review.
-- Session: d4bf45e3-5d59-42a4-9536-981f57bc9ed4 (Bia/Ham vs Ui/Mook, final 3–4)

insert into public.match_gesture_logs (
  court_setup_key,
  friendly_session_id,
  competition_id,
  game_number,
  court_id,
  match_started_at,
  match_ended_at,
  final_score,
  winner,
  player_stats,
  point_events,
  gestures,
  roster,
  created_by,
  updated_at
)
values (
  'd4bf45e3-5d59-42a4-9536-981f57bc9ed4',
  'd4bf45e3-5d59-42a4-9536-981f57bc9ed4',
  null,
  null,
  null,
  '2026-06-09 08:30:00+00',
  '2026-06-09 09:12:00+00',
  '{"pointsA":0,"pointsB":0,"gamesA":3,"gamesB":4}'::jsonb,
  'b',
  $player_stats$[
    {"playerKey":"69666c11-7080-44ba-bb24-d7271e542df2","playerId":"69666c11-7080-44ba-bb24-d7271e542df2","displayName":"Bia","quadrant":"TL","totalShots":9,"scored":5,"fouls":2,"unregistered":2,"successRate":71,"byType":{"smash":{"scored":1,"foul":1},"backhand":{"scored":2,"foul":0},"forehand":{"scored":1,"foul":1},"volley":{"scored":1,"foul":0}}},
    {"playerKey":"ham","playerId":null,"displayName":"Ham","quadrant":"TR","totalShots":8,"scored":4,"fouls":2,"unregistered":2,"successRate":67,"byType":{"smash":{"scored":0,"foul":1},"backhand":{"scored":1,"foul":0},"forehand":{"scored":2,"foul":1},"volley":{"scored":1,"foul":0}}},
    {"playerKey":"a6f65f96-7ab1-4f56-ade2-5ef785242b75","playerId":"a6f65f96-7ab1-4f56-ade2-5ef785242b75","displayName":"Ui","quadrant":"BL","totalShots":10,"scored":6,"fouls":2,"unregistered":2,"successRate":75,"byType":{"smash":{"scored":2,"foul":0},"backhand":{"scored":1,"foul":1},"forehand":{"scored":2,"foul":0},"volley":{"scored":1,"foul":1}}},
    {"playerKey":"mook","playerId":null,"displayName":"Mook","quadrant":"BR","totalShots":9,"scored":5,"fouls":1,"unregistered":3,"successRate":83,"byType":{"smash":{"scored":1,"foul":0},"backhand":{"scored":2,"foul":0},"forehand":{"scored":1,"foul":1},"volley":{"scored":1,"foul":0}}}
  ]$player_stats$::jsonb,
  $point_events$[
    {"at":"2026-06-09T08:32:10.000Z","winner":"a","scoreAfter":{"pointsA":0,"pointsB":0,"gamesA":1,"gamesB":0},"winnerGestureId":"g-win-01","loserGestureId":"g-lose-01","winnerQuadrant":"TR","loserQuadrant":"BL","isServe":true},
    {"at":"2026-06-09T08:38:22.000Z","winner":"a","scoreAfter":{"pointsA":0,"pointsB":0,"gamesA":2,"gamesB":0},"winnerGestureId":"g-win-02","loserGestureId":"g-lose-02","winnerQuadrant":"TL","loserQuadrant":"BR","isServe":false},
    {"at":"2026-06-09T08:44:05.000Z","winner":"b","scoreAfter":{"pointsA":0,"pointsB":0,"gamesA":2,"gamesB":1},"winnerGestureId":"g-win-03","loserGestureId":"g-lose-03","winnerQuadrant":"BL","loserQuadrant":"TR","isServe":false},
    {"at":"2026-06-09T08:51:40.000Z","winner":"a","scoreAfter":{"pointsA":0,"pointsB":0,"gamesA":3,"gamesB":1},"winnerGestureId":"g-win-04","loserGestureId":"g-lose-04","winnerQuadrant":"TR","loserQuadrant":"BL","isServe":false},
    {"at":"2026-06-09T08:58:18.000Z","winner":"b","scoreAfter":{"pointsA":0,"pointsB":0,"gamesA":3,"gamesB":2},"winnerGestureId":"g-win-05","loserGestureId":"g-lose-05","winnerQuadrant":"BR","loserQuadrant":"TL","isServe":false},
    {"at":"2026-06-09T09:04:55.000Z","winner":"b","scoreAfter":{"pointsA":0,"pointsB":0,"gamesA":3,"gamesB":3},"winnerGestureId":"g-win-06","loserGestureId":"g-lose-06","winnerQuadrant":"BL","loserQuadrant":"TR","isServe":false},
    {"at":"2026-06-09T09:11:30.000Z","winner":"b","scoreAfter":{"pointsA":0,"pointsB":0,"gamesA":3,"gamesB":4},"winnerGestureId":"g-win-07","loserGestureId":"g-lose-07","winnerQuadrant":"BR","loserQuadrant":"TL","isServe":false}
  ]$point_events$::jsonb,
  $gestures$[
    {"id":"g-win-01","at":"2026-06-09T08:32:08.000Z","startQuadrant":"TR","endQuadrant":"BL","team":"a","shape":"FOREHAND","shotCategory":"forehand-score","shotLabel":"Forehand Score","shotZone":"back","durationMs":420,"start":{"x":0.62,"y":0.28},"end":{"x":0.38,"y":0.72},"anchors":[{"x":0.62,"y":0.28},{"x":0.55,"y":0.45},{"x":0.38,"y":0.72}]},
    {"id":"g-lose-01","at":"2026-06-09T08:32:10.000Z","startQuadrant":"BL","endQuadrant":"BL","team":"b","shape":"BACKHAND","shotCategory":"backhand-lr-foul","shotLabel":"Backhand Foul","shotZone":"inner","durationMs":380,"start":{"x":0.35,"y":0.68},"end":{"x":0.42,"y":0.78},"anchors":[{"x":0.35,"y":0.68},{"x":0.42,"y":0.78}]},
    {"id":"g-rally-01","at":"2026-06-09T08:37:50.000Z","startQuadrant":"BL","endQuadrant":"TR","team":"b","shape":"VOLLEY","shotCategory":"volley-score","shotLabel":"Volley FH Score","shotZone":"inner","durationMs":290,"start":{"x":0.4,"y":0.58},"end":{"x":0.58,"y":0.42},"anchors":[{"x":0.4,"y":0.58},{"x":0.58,"y":0.42}]},
    {"id":"g-win-02","at":"2026-06-09T08:38:20.000Z","startQuadrant":"TL","endQuadrant":"BR","team":"a","shape":"LOB","shotCategory":"lob-score","shotLabel":"Lob Score","shotZone":"back","durationMs":510,"start":{"x":0.28,"y":0.32},"end":{"x":0.72,"y":0.78},"anchors":[{"x":0.28,"y":0.32},{"x":0.45,"y":0.55},{"x":0.72,"y":0.78}]},
    {"id":"g-lose-02","at":"2026-06-09T08:38:22.000Z","startQuadrant":"BR","endQuadrant":"BR","team":"b","shape":"SMASH","shotCategory":"smash-foul","shotLabel":"Smash Foul","shotZone":"back","durationMs":340,"start":{"x":0.68,"y":0.72},"end":{"x":0.7,"y":0.85},"anchors":[{"x":0.68,"y":0.72},{"x":0.7,"y":0.85}]},
    {"id":"g-win-03","at":"2026-06-09T08:44:03.000Z","startQuadrant":"BL","endQuadrant":"TR","team":"b","shape":"FOREHAND","shotCategory":"forehand-score","shotLabel":"Forehand Score","shotZone":"back","durationMs":450,"start":{"x":0.32,"y":0.75},"end":{"x":0.65,"y":0.35},"anchors":[{"x":0.32,"y":0.75},{"x":0.48,"y":0.55},{"x":0.65,"y":0.35}]},
    {"id":"g-lose-03","at":"2026-06-09T08:44:05.000Z","startQuadrant":"TR","endQuadrant":"TR","team":"a","shape":"VOLLEY","shotCategory":"volley-foul","shotLabel":"Volley Foul","shotZone":"inner","durationMs":260,"start":{"x":0.58,"y":0.48},"end":{"x":0.62,"y":0.52},"anchors":[{"x":0.58,"y":0.48},{"x":0.62,"y":0.52}]},
    {"id":"g-win-04","at":"2026-06-09T08:51:38.000Z","startQuadrant":"TR","endQuadrant":"BL","team":"a","shape":"BACKHAND","shotCategory":"backhand-lr-score","shotLabel":"Backhand Score","shotZone":"back","durationMs":400,"start":{"x":0.7,"y":0.3},"end":{"x":0.3,"y":0.7},"anchors":[{"x":0.7,"y":0.3},{"x":0.5,"y":0.5},{"x":0.3,"y":0.7}]},
    {"id":"g-lose-04","at":"2026-06-09T08:51:40.000Z","startQuadrant":"BL","endQuadrant":"BL","team":"b","shape":"FOREHAND","shotCategory":"forehand-foul","shotLabel":"Forehand Foul","shotZone":"inner","durationMs":310,"start":{"x":0.38,"y":0.62},"end":{"x":0.42,"y":0.7},"anchors":[{"x":0.38,"y":0.62},{"x":0.42,"y":0.7}]},
    {"id":"g-win-05","at":"2026-06-09T08:58:16.000Z","startQuadrant":"BR","endQuadrant":"TL","team":"b","shape":"SMASH","shotCategory":"smash-score","shotLabel":"Smash Score","shotZone":"back","durationMs":280,"start":{"x":0.72,"y":0.68},"end":{"x":0.28,"y":0.25},"anchors":[{"x":0.72,"y":0.68},{"x":0.72,"y":0.45},{"x":0.28,"y":0.25}]},
    {"id":"g-lose-05","at":"2026-06-09T08:58:18.000Z","startQuadrant":"TL","endQuadrant":"TL","team":"a","shape":"VOLLEY","shotCategory":"volley-foul","shotLabel":"Volley OH Foul","shotZone":"inner","durationMs":240,"start":{"x":0.25,"y":0.42},"end":{"x":0.28,"y":0.48},"anchors":[{"x":0.25,"y":0.42},{"x":0.28,"y":0.48}]},
    {"id":"g-win-06","at":"2026-06-09T09:04:53.000Z","startQuadrant":"BL","endQuadrant":"TR","team":"b","shape":"VOLLEY","shotCategory":"volley-score","shotLabel":"Volley BH Score","shotZone":"inner","durationMs":220,"start":{"x":0.35,"y":0.55},"end":{"x":0.6,"y":0.45},"anchors":[{"x":0.35,"y":0.55},{"x":0.48,"y":0.5},{"x":0.6,"y":0.45}]},
    {"id":"g-lose-06","at":"2026-06-09T09:04:55.000Z","startQuadrant":"TR","endQuadrant":"TR","team":"a","shape":"BACKHAND","shotCategory":"backhand-lr-foul","shotLabel":"Backhand Foul","shotZone":"back","durationMs":360,"start":{"x":0.65,"y":0.38},"end":{"x":0.58,"y":0.48},"anchors":[{"x":0.65,"y":0.38},{"x":0.58,"y":0.48}]},
    {"id":"g-win-07","at":"2026-06-09T09:11:28.000Z","startQuadrant":"BR","endQuadrant":"TL","team":"b","shape":"FOREHAND","shotCategory":"forehand-score","shotLabel":"Forehand Score","shotZone":"back","durationMs":430,"start":{"x":0.68,"y":0.72},"end":{"x":0.32,"y":0.28},"anchors":[{"x":0.68,"y":0.72},{"x":0.5,"y":0.5},{"x":0.32,"y":0.28}]},
    {"id":"g-lose-07","at":"2026-06-09T09:11:30.000Z","startQuadrant":"TL","endQuadrant":"TL","team":"a","shape":"SMASH","shotCategory":"smash-foul","shotLabel":"Smash Foul","shotZone":"back","durationMs":300,"start":{"x":0.3,"y":0.35},"end":{"x":0.32,"y":0.48},"anchors":[{"x":0.3,"y":0.35},{"x":0.32,"y":0.48}]}
  ]$gestures$::jsonb,
  $roster$[
    {"quadrant":"TL","playerId":"69666c11-7080-44ba-bb24-d7271e542df2","name":"Bia"},
    {"quadrant":"TR","playerId":null,"name":"Ham"},
    {"quadrant":"BL","playerId":"a6f65f96-7ab1-4f56-ade2-5ef785242b75","name":"Ui"},
    {"quadrant":"BR","playerId":null,"name":"Mook"}
  ]$roster$::jsonb,
  '7bdc33ac-7f21-4ebf-bfbf-343080724890',
  now()
)
on conflict (court_setup_key) do update set
  friendly_session_id = excluded.friendly_session_id,
  match_started_at = excluded.match_started_at,
  match_ended_at = excluded.match_ended_at,
  final_score = excluded.final_score,
  winner = excluded.winner,
  player_stats = excluded.player_stats,
  point_events = excluded.point_events,
  gestures = excluded.gestures,
  roster = excluded.roster,
  updated_at = now();
