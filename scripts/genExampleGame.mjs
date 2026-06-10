// Generates an example organized friendly game + full match_gesture_logs row.
// Writes a reusable seed to supabase/seed/example_friendly_game.sql.
import { writeFileSync } from 'node:fs'

const ADMIN = '7bdc33ac-7f21-4ebf-bfbf-343080724890' // Peta Kirikiri (admin)
// Linked member profiles (real accounts).
const MEMBER = {
  boon: { id: '6778b3f3-2583-472c-ae02-77780e01f4f1', avatar: 'https://profile.line-scdn.net/0hC4nV_W2pHBtDLwM8XrdiJTN_H3FgXkUJb0FbfSEuF35-H1seb0oEeSEuQy4rTFhMPRxWfXd9S3hhYz4bPTonFRVfIysuXRxPDTlWNTVEN3Yoag0KKwEJGHB6GX8OdDoZPDsWHTBvFVw8Fl43JgAaOAZHCS96FggFEXhwTUYdcpgsLWtObklSf3YvRiL9' },
  bia: { id: 'f5384b42-d681-4b49-90aa-926d6f34e1f4', avatar: 'https://profile.line-scdn.net/0hTwluXk3sC1hBDBQANmp1ZjFcCDJifVJKaGoTPiEEUGF0aRsMPWxGPH0PUmsoORwKbWJAbHFeB2pjTx92KjE_Vwh2Vy97Xk8GaDk7QAtRJRgLTBFJLD88Ih0OLTgvYTV6cW0kfTQPLG4HSSVzaAsXNzBYAQ8KRhpSGFtnDkQ-ZdsuDnwNbGpFPHQMUWH_' },
  peta: { id: ADMIN, avatar: 'https://profile.line-scdn.net/0hui3sMtFnKkYeCjqLX3lUOW5aKSw9e3NUOz9jdS0JdSVxaG0RND4wdC4LJ3BxPDkXZW4xdyhedXUSGV0gAFzWchk6d3cjO28QMmhsow' },
  pum: { id: '7fefcfbb-12dc-4c38-93f8-75bfa4e7dbde', avatar: 'https://profile.line-scdn.net/0hMZYDKxMYEnV0PQ1ohJZsSwRtER9XTEtnWQhdE0NvGURBWFUmW1tZFxJuGEAdBVdxWwhfFkk7T0VWWA5BOgAbVx9vKBISdjVcGjwvdxlePhJKaxNeIiEVcUBDOzE3dAtCORgmVh5kGjMdTRxkCgAEdBhuJwIQezRHXWp-I3EPfPYbP2UgWVtcEUE9SEzK' },
}
const SESSION_ID = '7a15910b-54a0-4f91-bf20-f69b74ca8bf2'

// deterministic PRNG so reruns are stable
let s = 20260610
const rnd = () => {
  s = (s * 1664525 + 1013904223) >>> 0
  return s / 4294967296
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const round = (n) => Math.round(n * 1000) / 1000
const clamp01 = (n) => Math.max(0, Math.min(1, n))
const jitter = (base, amt) => clamp01(base + (rnd() - 0.5) * 2 * amt)

// Player order → quadrants: TL,TR (team a / top), BL,BR (team b / bottom)
const PLAYERS = ['Boon', 'Bia', 'Peta', 'PumCooper']
const PROFILE_IDS = [MEMBER.boon.id, MEMBER.bia.id, MEMBER.peta.id, MEMBER.pum.id]
const PROFILE_AVATARS = [MEMBER.boon.avatar, MEMBER.bia.avatar, MEMBER.peta.avatar, MEMBER.pum.avatar]

const Q = {
  TL: { team: 'a', half: 'top', name: 'Boon', pid: MEMBER.boon.id },
  TR: { team: 'a', half: 'top', name: 'Bia', pid: MEMBER.bia.id },
  BL: { team: 'b', half: 'bottom', name: 'Peta', pid: MEMBER.peta.id },
  BR: { team: 'b', half: 'bottom', name: 'PumCooper', pid: MEMBER.pum.id },
}

// Distinct play styles so the stats/heat map read differently per player.
const PROFILE = {
  TL: { kinds: ['smash', 'smash', 'volley', 'forehand'], x: 0.72, xs: 0.12, y: 0.28, ys: 0.16, inner: 0.6 },
  TR: { kinds: ['forehand', 'forehand', 'lob', 'backhand'], x: 0.5, xs: 0.1, y: 0.72, ys: 0.14, inner: 0.2 },
  BL: { kinds: ['backhand', 'backhand', 'lob', 'forehand'], x: 0.28, xs: 0.13, y: 0.62, ys: 0.2, inner: 0.3 },
  BR: { kinds: ['volley', 'volley', 'smash', 'backhand'], x: 0.7, xs: 0.24, y: 0.36, ys: 0.26, inner: 0.65 },
}

const KIND_CAT = { smash: 'smash', forehand: 'forehand', backhand: 'backhand-lr', volley: 'volley', lob: 'lob' }
const KIND_LABEL = { smash: 'Smash', forehand: 'Forehand', backhand: 'Backhand', volley: 'Volley', lob: 'Lob' }
const KIND_SHAPE = { smash: 'SMASH', forehand: 'FOREHAND', backhand: 'BACKHAND', volley: 'VOLLEY', lob: 'LOB' }
const KIND_GROUP = { smash: 'smash', forehand: 'forehand', backhand: 'backhand', volley: 'volley', lob: null }

const teamPlayers = { a: ['TL', 'TR'], b: ['BL', 'BR'] }
const opp = { a: 'b', b: 'a' }

let t = Date.parse('2026-06-10T11:00:00.000Z') // 18:00 +07
let gi = 0
const gestures = []

function mkGesture(q, kind, outcome) {
  gi += 1
  const id = `ex-g-${String(gi).padStart(3, '0')}`
  const land = { x: round(jitter(PROFILE[q].x, PROFILE[q].xs)), y: round(jitter(PROFILE[q].y, PROFILE[q].ys)), half: Q[q].half }
  const inner = rnd() < PROFILE[q].inner
  const courtY = land.half === 'top' ? round(0.5 - land.y * 0.5) : round(0.5 + land.y * 0.5)
  gestures.push({
    id,
    at: new Date(t).toISOString(),
    startQuadrant: q,
    endQuadrant: q,
    team: Q[q].team,
    shape: KIND_SHAPE[kind],
    shotCategory: `${KIND_CAT[kind]}-${outcome}`,
    shotLabel: `${KIND_LABEL[kind]} ${outcome === 'score' ? 'Score' : 'Foul'}`,
    shotZone: inner ? 'inner' : 'back',
    durationMs: 220 + Math.floor(rnd() * 340),
    start: { x: round(jitter(land.x, 0.1)), y: round(land.half === 'top' ? jitter(0.3, 0.1) : jitter(0.7, 0.1)) },
    end: { x: land.x, y: courtY },
    actorQuadrant: q,
    heatMapEnd: land,
  })
  return id
}

const gameWinners = ['a', 'b', 'a', 'a'] // 4 games, final 3–1 to team A
let gamesA = 0
let gamesB = 0
const pointEvents = []

gameWinners.forEach((gw) => {
  const n = 3 + Math.floor(rnd() * 2) // 3–4 points per game
  const seq = []
  for (let i = 0; i < n - 1; i++) seq.push(rnd() < 0.35 ? opp[gw] : gw)
  seq.push(gw)
  let pa = 0
  let pb = 0
  seq.forEach((ptWinner, pi) => {
    t += (120 + Math.floor(rnd() * 150)) * 1000
    const isLast = pi === seq.length - 1
    const wq = pick(teamPlayers[ptWinner])
    const lq = pick(teamPlayers[opp[ptWinner]])
    const winId = mkGesture(wq, pick(PROFILE[wq].kinds), 'score')
    const loseId = mkGesture(lq, pick(PROFILE[lq].kinds), 'foul')
    if (ptWinner === 'a') pa += 1
    else pb += 1
    let scoreAfter
    if (isLast) {
      if (gw === 'a') gamesA += 1
      else gamesB += 1
      scoreAfter = { pointsA: 0, pointsB: 0, gamesA, gamesB }
    } else {
      scoreAfter = { pointsA: Math.min(pa, 3), pointsB: Math.min(pb, 3), gamesA, gamesB }
    }
    pointEvents.push({
      at: new Date(t + 1500).toISOString(),
      winner: ptWinner,
      scoreAfter,
      winnerGestureId: winId,
      loserGestureId: loseId,
      winnerQuadrant: wq,
      loserQuadrant: lq,
      isServe: pi === 0,
    })
  })
})

// player_stats snapshot computed from gestures
const ROSTER_ORDER = ['TL', 'TR', 'BL', 'BR']
const playerStats = ROSTER_ORDER.map((q) => {
  const byType = { smash: { scored: 0, foul: 0 }, backhand: { scored: 0, foul: 0 }, forehand: { scored: 0, foul: 0 }, volley: { scored: 0, foul: 0 } }
  let scored = 0
  let fouls = 0
  for (const g of gestures) {
    if (g.actorQuadrant !== q) continue
    const isScore = g.shotCategory.endsWith('-score')
    if (isScore) scored += 1
    else fouls += 1
    const kind = g.shotCategory.split('-')[0]
    const group = kind === 'backhand' ? 'backhand' : KIND_GROUP[kind]
    if (group && byType[group]) {
      if (isScore) byType[group].scored += 1
      else byType[group].foul += 1
    }
  }
  const judged = scored + fouls
  return {
    playerKey: Q[q].pid ?? q,
    playerId: Q[q].pid,
    displayName: Q[q].name,
    quadrant: q,
    totalShots: judged,
    scored,
    fouls,
    unregistered: 0,
    successRate: judged > 0 ? Math.round((scored / judged) * 100) : 0,
    byType,
  }
})

const roster = ROSTER_ORDER.map((q) => ({ quadrant: q, playerId: Q[q].pid, name: Q[q].name }))

const organizedConfig = {
  day: '2026-06-10',
  startHour: 18,
  startMinute: 0,
  ruleFormat: 'americano',
  partnerStyle: 'swapped',
  americanoScoring: 'open',
  gameCount: 4,
  gameMinutes: 15,
  breakMinutes: 0,
  previewSeed: 7,
}

const dq = (label, obj) => `$${label}$${JSON.stringify(obj)}$${label}$::jsonb`

const sql = `-- Example organized friendly game + full match log (Boon & เบีย สิงห์ vs Peta & PumCooper).
-- Session: ${SESSION_ID}

insert into public.friendly_sessions (
  id, created_by, title, visibility, play_mode, status,
  players, profile_ids, profile_avatars, organized_config
) values (
  '${SESSION_ID}', '${ADMIN}', 'Thursday Social — Court 1', 'public', 'organized', 'ready',
  ${dq('pl', PLAYERS)}, ${dq('pi', PROFILE_IDS)}, ${dq('pa', PROFILE_AVATARS)}, ${dq('oc', organizedConfig)}
)
on conflict (id) do update set
  title = excluded.title,
  play_mode = excluded.play_mode,
  players = excluded.players,
  profile_ids = excluded.profile_ids,
  profile_avatars = excluded.profile_avatars,
  organized_config = excluded.organized_config;

insert into public.match_gesture_logs (
  court_setup_key, friendly_session_id, competition_id, game_number, court_id,
  match_started_at, match_ended_at, final_score, winner,
  player_stats, point_events, gestures, roster, created_by, updated_at
) values (
  '${SESSION_ID}', '${SESSION_ID}', null, null, null,
  '2026-06-10T11:00:00.000Z', '2026-06-10T12:00:00.000Z',
  ${dq('fs', { pointsA: 0, pointsB: 0, gamesA, gamesB })}, 'a',
  ${dq('ps', playerStats)},
  ${dq('pe', pointEvents)},
  ${dq('ge', gestures)},
  ${dq('ro', roster)},
  '${ADMIN}', now()
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
`

writeFileSync(new URL('../supabase/seed/example_friendly_game.sql', import.meta.url), sql)
console.log(JSON.stringify({ sessionId: SESSION_ID, gestures: gestures.length, points: pointEvents.length, gamesA, gamesB }))
