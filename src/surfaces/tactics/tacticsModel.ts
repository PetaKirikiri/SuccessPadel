/** Pure court-space model. Metres, seconds; origin is the opponents' back-left corner.
 * These are adjustable coaching assumptions, not calibrated point-win probabilities.
 * No network, React, or session dependencies: this module can be reused independently.
 */
export type Point = { x: number; y: number }
export type Player = Point & { id: number; team: 'opponents' | 'you' }
export type ShotKind = 'drive' | 'lob'
export type TacticsState = {
  players: Player[]; ball: Point; target: Point; hitter: number; kind: ShotKind; speed: number
}
export type Sample = Point & { z: number; t: number; bounced: boolean }
export type Shot = {
  samples: Sample[]; flight: number; margin: number; score: number
  valid: boolean; reason: 'net' | 'fence' | null; interceptor: number | null
}
export const COURT = { width: 10, length: 20, net: 10, service: 6.95 } as const
export const ASSUMPTIONS = { reaction: 0.22, runSpeed: 4.5, acceleration: 5, reach: 0.8, maxReachHeight: 2.7 }
const G = 9.81
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

export function initialTactics(): TacticsState {
  return {
    players: [
      { id: 1, team: 'opponents', x: 2.7, y: 7.4 },
      { id: 2, team: 'opponents', x: 7.3, y: 7.4 },
      { id: 3, team: 'you', x: 3.0, y: 15.7 },
      { id: 4, team: 'you', x: 7.3, y: 13.9 },
    ],
    ball: { x: 3.55, y: 15.3 }, target: { x: 8.6, y: 2.5 }, hitter: 3, kind: 'drive', speed: 12,
  }
}

/** Time to get a racket within reach, including reaction and acceleration from rest. */
export function arrivalTime(player: Point, point: Point): number {
  const d = Math.max(0, distance(player, point) - ASSUMPTIONS.reach)
  const rampDistance = ASSUMPTIONS.runSpeed ** 2 / (2 * ASSUMPTIONS.acceleration)
  const movement = d <= rampDistance
    ? Math.sqrt(2 * d / ASSUMPTIONS.acceleration)
    : ASSUMPTIONS.runSpeed / ASSUMPTIONS.acceleration + (d - rampDistance) / ASSUMPTIONS.runSpeed
  return ASSUMPTIONS.reaction + movement
}

export function evaluateShot(state: TacticsState, target: Point = state.target): Shot {
  const origin = state.ball
  const flight = distance(origin, target) / state.speed
  const z0 = state.kind === 'lob' ? 0.65 : 1.0
  const vz = (G * flight * flight / 2 - z0) / flight
  const height = (t: number) => z0 + vz * t - G * t * t / 2
  const netFraction = (origin.y - COURT.net) / (origin.y - target.y)
  const netHeight = height(flight * netFraction)
  const netX = origin.x + (target.x - origin.x) * netFraction
  const clearance = 0.88 + 0.04 * Math.abs(netX - 5) / 5 + 0.05
  const valid = netHeight >= clearance
  const samples: Sample[] = []
  const steps = Math.max(12, Math.ceil(flight / 0.04))
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    if (!valid && f > netFraction) break
    samples.push({ x: origin.x + (target.x - origin.x) * f, y: origin.y + (target.y - origin.y) * f, z: height(f * flight), t: f * flight, bounced: false })
  }
  if (!valid) {
    samples.push({ x: netX, y: COURT.net, z: Math.max(0, netHeight), t: flight * netFraction, bounced: false })
    return { samples, flight, margin: -1, score: 0, valid: false, reason: 'net', interceptor: null }
  }
  // Follow the first bounce through glass rebounds until the second bounce.
  let x = target.x, y = target.y, z = 0, t = flight
  let vx = (target.x - origin.x) / flight * 0.72
  let vy = (target.y - origin.y) / flight * 0.72
  let vertical = Math.abs(vz - G * flight) * 0.68
  for (let i = 0; i < 160; i++) {
    const dt = 0.025
    x += vx * dt; y += vy * dt; z += vertical * dt - G * dt * dt / 2
    vertical -= G * dt; t += dt
    if (z <= 0 || y >= 10) break
    if (x < 0 || x > 10) {
      // Front side enclosure is mesh; its unpredictable rebound is deliberately not projected.
      if (y > 4 || z > 3) break
      x = x < 0 ? -x : 20 - x; vx *= -0.75
    }
    if (y < 0) {
      if (z > 3) break
      y = -y; vy *= -0.75
    }
    samples.push({ x, y, z, t, bounced: true })
  }
  let margin = 3, interceptor: number | null = null
  for (const point of samples) {
    if (point.y >= 10 || point.z > ASSUMPTIONS.maxReachHeight || point.z < 0.1) continue
    for (const player of state.players) {
      if (player.team !== 'opponents') continue
      const delta = arrivalTime(player, point) - point.t
      if (delta < margin) { margin = delta; interceptor = player.id }
    }
  }
  const edge = Math.min(target.x, 10 - target.x, target.y, 10 - target.y)
  const edgePenalty = 22 * (1 - clamp(edge / 0.65, 0, 1))
  const score = clamp(100 / (1 + Math.exp(-margin / 0.24)) - edgePenalty, 0, 100)
  return { samples, flight, margin, score, valid: true, reason: null, interceptor }
}

export type HeatCell = Point & { score: number; valid: boolean; lobScore?: number }

/** A useful lob can force opponents off the net without winning outright.
 * Require a deep, in-bounds landing behind both players and no reachable
 * overhead before either player has been forced at least two metres back.
 */
export function lobOpportunity(state: TacticsState, shot: Shot, target: Point): number {
  if (!shot.valid || state.kind !== 'lob' || target.y < 0.6 || target.y > 3.4 || target.x < 0.6 || target.x > 9.4) return 0
  if (Math.max(...shot.samples.filter(p => !p.bounced).map(p => p.z)) < 3.5) return 0
  const opponents = state.players.filter(p => p.team === 'opponents')
  const retreat = Math.min(...opponents.map(p => p.y - target.y))
  if (retreat < 2.8) return 0
  for (const p of opponents) {
    const earlyOverhead = shot.samples.some(point =>
      !point.bounced && point.y < 10 && point.y >= p.y - 2 && point.z > 0.1 && point.z <= 3.1 && arrivalTime(p, point) <= point.t,
    )
    if (earlyOverhead) return 0
  }
  return 65 + 20 * clamp((retreat - 2.8) / 4, 0, 1) + 15 * clamp((3.4 - target.y) / 2, 0, 1)
}

export function placeBall(state: TacticsState, point: Point): TacticsState {
  return { ...state, ball: { x: clamp(point.x, 0.15, 9.85), y: clamp(point.y, 10.15, 19.85) } }
}
export function calculateHeatmap(state: TacticsState): HeatCell[] {
  const cells: HeatCell[] = []
  const size = 0.25
  for (let y = size / 2; y < 10; y += size) {
    for (let x = size / 2; x < 10; x += size) {
      const shot = evaluateShot(state, { x, y })
      cells.push({ x, y, score: shot.score, valid: shot.valid })
    }
  }
  return cells
}

export function movePlayer(state: TacticsState, id: number, point: Point): TacticsState {
  const player = state.players.find(p => p.id === id)
  if (!player) return state
  const next = { ...player, x: clamp(point.x, 0.35, 9.65), y: clamp(point.y, player.team === 'you' ? 10.4 : 0.35, player.team === 'you' ? 19.65 : 9.6) }
  return { ...state, players: state.players.map(p => p.id === id ? next : p) }
}

/** Positional exposure to a fast return, rather than eventual retrieval after
 * a wall bounce. Inputs are normalized with the shooting team in the bottom half.
 * Consider both opponents' current contact positions and the planned shot's
 * landing area; the quickest threat determines the time available at each point.
 */
export function defensiveSafety(state: TacticsState, returnArea: Point, target: Point): number {
  const sources: Point[] = [...state.players.filter(p => p.team === 'opponents'), returnArea]
  const defenders = state.players.filter(p => p.team === 'you')
  const shooter = defenders.reduce((nearest, p) => distance(p, state.ball) < distance(nearest, state.ball) ? p : nearest)
  let worstLane = Infinity
  for (const source of sources) {
    const flight = distance(source, target) / 16
    let bestIntercept = -Infinity
    for (let step = 1; step <= 20; step++) {
      const fraction = step / 20
      const point = { x: source.x + (target.x - source.x) * fraction, y: source.y + (target.y - source.y) * fraction }
      if (point.y <= 10) continue
      // This positional field assumes ready footwork, rather than the shot
      // evaluator's acceleration from rest. A player can screen space behind
      // them by intercepting the direct lane before the return reaches it.
      const coverTime = Math.min(...defenders.map(player =>
        ASSUMPTIONS.reaction + Math.max(0, distance(player, point) - ASSUMPTIONS.reach) / ASSUMPTIONS.runSpeed + (player.id === shooter.id ? 0.12 : 0),
      ))
      bestIntercept = Math.max(bestIntercept, flight * fraction - coverTime)
    }
    worstLane = Math.min(worstLane, bestIntercept)
  }
  // Any opponent being able to attack a gap makes it exposed. No late glass
  // recovery or boundary-accuracy bonus is counted as defensive coverage.
  return 100 / (1 + Math.exp(-worstLane / 0.16))
}

/** Automatically compare legal landing cells and a small set of realistic shot paces.
 * Normalize to a bottom-half hitter, then transform the entire result back so the
 * ball can start on either side. The chosen starting point never follows a player.
 */
export function chooseAutomaticShot(input: TacticsState): { state: TacticsState; cells: HeatCell[]; shot: Shot } {
  const flipped = input.ball.y < 10
  const reflect = (p: Point): Point => ({ x: 10 - p.x, y: 20 - p.y })
  const base: TacticsState = flipped ? {
    ...input, ball: reflect(input.ball),
    players: input.players.map(p => ({ ...p, ...reflect(p), team: p.team === 'you' ? 'opponents' : 'you' })),
  } : input
  const options: { kind: ShotKind; speed: number }[] = [
    { kind: 'drive', speed: 12 }, { kind: 'drive', speed: 16 }, { kind: 'lob', speed: 7 },
  ]
  const cells: HeatCell[] = []
  let best: { state: TacticsState; shot: Shot } | null = null
  for (let y = 0.125; y < 10; y += 0.25) {
    for (let x = 0.125; x < 10; x += 0.25) {
      const target = { x, y }
      let score = 0, valid = false, lobScore = 0
      for (const option of options) {
        const candidate = { ...base, ...option, target }
        let shot = evaluateShot(candidate)
        if (!shot.valid) continue
        if (option.kind === 'lob') {
          lobScore = lobOpportunity(candidate, shot, target)
          shot = { ...shot, score: Math.max(shot.score, lobScore) }
        }
        valid = true; score = Math.max(score, shot.score)
        if (!best || shot.score > best.shot.score || (shot.score === best.shot.score && shot.margin > best.shot.margin)) {
          best = { state: candidate, shot }
        }
      }
      cells.push({ ...target, score, valid, lobScore })
    }
  }
  // A blocked formation still gets its best legal shot, without claiming it is open.
  const chosen = best ?? { state: base, shot: evaluateShot(base) }
  for (let y = 10.125; y < 20; y += 0.25) {
    for (let x = 0.125; x < 10; x += 0.25) {
      const target = { x, y }
      cells.push({ ...target, score: defensiveSafety(base, chosen.state.target, target), valid: true })
    }
  }
  if (!flipped) return { ...chosen, cells }
  return {
    state: { ...chosen.state, ball: input.ball, players: input.players, target: reflect(chosen.state.target) },
    shot: { ...chosen.shot, samples: chosen.shot.samples.map(p => ({ ...p, ...reflect(p) })) },
    cells: cells.map(p => ({ ...p, ...reflect(p) })),
  }
}
