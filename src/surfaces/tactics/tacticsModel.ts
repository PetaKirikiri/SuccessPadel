/** Pure court-space model. Metres, seconds; origin is the opponents' back-left corner.
 * These are adjustable coaching assumptions, not calibrated point-win probabilities.
 * No network, React, or session dependencies: this module can be reused independently.
 */
export type Point = { x: number; y: number }
export type Player = Point & { id: number; team: 'opponents' | 'you' }
export type ShotKind = 'drive' | 'lob'
export type TacticsState = {
  players: Player[]; ball: Point; target: Point; hitter: number; ballOwner: number; kind: ShotKind; speed: number
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
  return selectShooter({
    players: [
      { id: 1, team: 'opponents', x: 2.7, y: 7.4 },
      { id: 2, team: 'opponents', x: 7.3, y: 7.4 },
      { id: 3, team: 'you', x: 3.0, y: 15.7 },
      { id: 4, team: 'you', x: 7.3, y: 13.9 },
    ],
    ball: { x: 3.55, y: 15.3 }, target: { x: 8.6, y: 2.5 }, hitter: 3, ballOwner: 3, kind: 'drive', speed: 12,
  }, 3)
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

/** The shot starts at the centre of its selected player. */
export function selectShooter(state: TacticsState, id: number): TacticsState {
  const player = state.players.find(p => p.id === id)
  if (!player) return state
  const ball = { x: player.x, y: player.y }
  return { ...state, ball, hitter: id, ballOwner: id }
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
  const moved = { ...state, players: state.players.map(p => p.id === id ? next : p) }
  return state.ballOwner === id ? selectShooter(moved, id) : moved
}

export type ReturnContact = Sample & { playerId: number; balance: number }

/** Anticipation allows an early move, not a return from a position the ball never visits.
 * Keep an early and a more balanced contact in each volley/bounce phase per opponent.
 */
export function possibleReturnContacts(state: TacticsState, shot: Shot): ReturnContact[] {
  if (!shot.valid) return []
  const contacts: ReturnContact[] = []
  for (const player of state.players.filter(p => p.team === 'opponents')) {
    for (const bounced of [false, true]) {
      const reachable = shot.samples.filter(p => p.bounced === bounced && p.y < 10 && p.z >= 0.15 && p.z <= ASSUMPTIONS.maxReachHeight && arrivalTime(player, p) <= p.t + 0.5)
      if (!reachable.length) continue
      const first = reachable[0]
      const balanced = reachable.reduce((best, p) => p.t - arrivalTime(player, p) > best.t - arrivalTime(player, best) ? p : best)
      for (const point of first === balanced ? [first] : [first, balanced]) {
        contacts.push({ ...point, playerId: player.id, balance: clamp((point.t + 0.5 - arrivalTime(player, point)) / 0.4, 0, 1) })
      }
    }
  }
  return contacts
}

/** Return-to-bounce flight. A stretched, sharply redirected ball cannot use the
 * same pace as a balanced volley; low contacts must still clear the net.
 */
export function returnFlight(state: TacticsState, contact: ReturnContact, target: Point, pace = 1): { time: number; vertical: number } | null {
  if (target.y <= 10 || contact.y >= 10) return null
  const back = { x: state.ball.x - contact.x, y: state.ball.y - contact.y }
  const reply = { x: target.x - contact.x, y: target.y - contact.y }
  const length = Math.hypot(reply.x, reply.y)
  const cosine = clamp((back.x * reply.x + back.y * reply.y) / (Math.hypot(back.x, back.y) * length), -1, 1)
  const turn = Math.acos(cosine) / Math.PI
  const maxPace = (10 + 6 * contact.balance) * (1 - 0.4 * turn)
  const time = length / (maxPace * pace)
  const vertical = (G * time * time / 2 - contact.z) / time
  const netTime = time * (10 - contact.y) / reply.y
  const netX = contact.x + reply.x * netTime / time
  const netHeight = contact.z + vertical * netTime - G * netTime * netTime / 2
  if (netHeight < 0.93 + 0.04 * Math.abs(netX - 5) / 5) return null
  return { time, vertical }
}

/** Safety against feasible replies to this particular shot, in bottom-half coordinates.
 * Neutral means no reachable/legal reply was modelled, rather than a guaranteed winner.
 */
export function defensiveSafety(state: TacticsState, contacts: ReturnContact[], target: Point): number {
  const defenders = state.players.filter(p => p.team === 'you')
  let worstLane = Infinity
  for (const contact of contacts) {
    for (const pace of [1, 0.8, 0.6, 0.4]) {
      const flight = returnFlight(state, contact, target, pace)
      if (!flight) continue
      let bestIntercept = -Infinity
      for (let step = 1; step <= 24; step++) {
        const fraction = step / 24, time = flight.time * fraction
        const point = { x: contact.x + (target.x - contact.x) * fraction, y: contact.y + (target.y - contact.y) * fraction }
        const height = contact.z + flight.vertical * time - G * time * time / 2
        if (point.y <= 10 || height > ASSUMPTIONS.maxReachHeight) continue
        // The outbound flight lets players get ready, but does not magically
        // move them towards a reply whose direction is not yet known.
        const coverTime = Math.min(...defenders.map(player =>
          arrivalTime(player, point) - Math.min(0.16, contact.t * 0.25) + (player.id === state.ballOwner ? Math.max(0, 0.18 - contact.t) : 0),
        ))
        bestIntercept = Math.max(bestIntercept, time - coverTime)
      }
      worstLane = Math.min(worstLane, bestIntercept)
    }
  }
  const nearest = Math.min(...defenders.map(player => distance(player, target)))
  const fade = clamp((nearest - 0.9) / 2, 0, 1)
  const localCoverage = 98 * (1 - fade * fade * (3 - 2 * fade))
  const laneCoverage = worstLane === Infinity ? 50 : 100 / (1 + Math.exp(-worstLane / 0.16))
  return Math.max(localCoverage, laneCoverage)
}

/** Execution tolerance for a normal rally shot, in bottom-half coordinates.
 * Perturb heading, launch angle and power together rather than assuming perfect aim.
 * These are conservative design assumptions, not a measured player skill rating.
 */
export function executionMargin(state: TacticsState): number {
  const { ball, target, speed } = state
  const length = distance(ball, target), flight = length / speed
  if (flight <= 0 || target.y >= 10) return 0
  const vertical = (G * flight * flight / 2 - 1) / flight
  const elevation = Math.atan2(vertical, speed), heading = Math.atan2(target.y - ball.y, target.x - ball.x)
  const velocity = Math.hypot(speed, vertical)
  let worst = 1
  for (const aim of [-0.04, 0, 0.04]) {
    for (const loft of [-0.025, 0, 0.025]) {
      for (const power of [0.94, 1, 1.06]) {
        const horizontal = velocity * power * Math.cos(elevation + loft)
        const vz = velocity * power * Math.sin(elevation + loft)
        const vx = horizontal * Math.cos(heading + aim), vy = horizontal * Math.sin(heading + aim)
        const duration = (vz + Math.sqrt(vz * vz + 2 * G)) / G
        const x = ball.x + vx * duration, y = ball.y + vy * duration
        const netTime = (10 - ball.y) / vy
        if (netTime <= 0 || netTime >= duration) return 0
        const netX = ball.x + vx * netTime
        const netHeight = 1 + vz * netTime - G * netTime * netTime / 2
        const clearance = netHeight - (0.88 + 0.04 * Math.abs(netX - 5) / 5)
        // Even the least accurate variant must retain some margin, not merely
        // be averaged away by better outcomes from the same delicate shot.
        worst = Math.min(worst, (x - 0.35) / 0.65, (9.65 - x) / 0.65,
          (y - 0.35) / 0.85, (9.65 - y) / 0.85, (clearance - 0.12) / 0.18)
        if (worst <= 0) return 0
      }
    }
  }
  return clamp(worst, 0, 1)
}

/** Automatically compare legal landing cells and a small set of realistic shot paces.
 * Normalize to a bottom-half hitter, then transform the entire result back so the
 * selected shooter owns the contact point on either side.
 */
export function chooseAutomaticShot(input: TacticsState): { state: TacticsState; cells: HeatCell[]; shot: Shot } {
  input = selectShooter(input, input.ballOwner)
  const flipped = input.ball.y < 10
  const reflect = (p: Point): Point => ({ x: 10 - p.x, y: 20 - p.y })
  const base: TacticsState = flipped ? {
    ...input, ball: reflect(input.ball), target: reflect(input.target),
    players: input.players.map(p => ({ ...p, ...reflect(p), team: p.team === 'you' ? 'opponents' : 'you' })),
  } : input
  const options: { kind: ShotKind; speed: number }[] = [
    { kind: 'drive', speed: 10 }, { kind: 'drive', speed: 12 }, { kind: 'drive', speed: 14 }, { kind: 'drive', speed: 16 }, { kind: 'lob', speed: 7 },
  ]
  const cells: HeatCell[] = []
  let best: { state: TacticsState; shot: Shot } | null = null
  let bestRank = -Infinity
  for (let y = 0.125; y < 10; y += 0.25) {
    for (let x = 0.125; x < 10; x += 0.25) {
      const target = { x, y }
      let score = 0, valid = false, lobScore = 0
      for (const option of options) {
        const candidate = { ...base, ...option, target }
        const shot = evaluateShot(candidate)
        if (!shot.valid) continue
        if (option.kind === 'lob') {
          lobScore = lobOpportunity(candidate, shot, target)
          // Lobs are optional landing zones, never the direct trajectory line.
          score = Math.max(score, lobScore)
          valid ||= lobScore > 0
          continue
        }
        valid = true; score = Math.max(score, shot.score)
        // From the back, teach a rally ball, not a touch-perfect short angle.
        if (Math.min(x, 10 - x, y, 10 - y) < 1.25) continue
        if (base.ball.y >= 14 && y > 6.5) continue
        const tolerance = executionMargin(candidate)
        if (tolerance <= 0) continue
        const rank = shot.score * 0.7 + tolerance * 30
        if (!best || rank > bestRank) {
          best = { state: candidate, shot }; bestRank = rank
        }
      }
      cells.push({ ...target, score, valid, lobScore })
    }
  }
  // A blocked formation still gets its best legal shot, without claiming it is open.
  const fallback = { ...base, target: { x: 5, y: 4 }, kind: 'drive' as const, speed: 10 }
  const chosen = best ?? { state: fallback, shot: evaluateShot(fallback) }
  const contacts = possibleReturnContacts(base, chosen.shot)
  for (let y = 10.125; y < 20; y += 0.25) {
    for (let x = 0.125; x < 10; x += 0.25) {
      const target = { x, y }
      cells.push({ ...target, score: defensiveSafety(base, contacts, target), valid: true })
    }
  }
  if (!flipped) return { ...chosen, cells }
  return {
    state: { ...chosen.state, ball: input.ball, players: input.players, target: reflect(chosen.state.target) },
    shot: { ...chosen.shot, samples: chosen.shot.samples.map(p => ({ ...p, ...reflect(p) })) },
    cells: cells.map(p => ({ ...p, ...reflect(p) })),
  }
}
