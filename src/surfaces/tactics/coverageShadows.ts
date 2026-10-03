import { possibleReturnContacts } from './tacticsModel.ts'
import type { Player, Point, Shot, TacticsState } from './tacticsModel.ts'

export type CoverageShadow = {
  playerId: number; upper: boolean; centre: Point; radius: number; polygon: Point[]
}

/** The geometric shadow of a player's racket/step footprint, away from the ball.
 * This explains screened space; it is not a guarantee against lobs or spin.
 */
export function playerShadow(player: Player, source: Point): CoverageShadow {
  const dx = player.x - source.x, dy = player.y - source.y
  const length = Math.max(0.01, Math.hypot(dx, dy))
  const radius = Math.min(1.15, length * 0.85)
  const ux = dx / length, uy = dy / length
  const back = radius * radius / length
  const side = radius * Math.sqrt(1 - radius * radius / (length * length))
  const left = { x: player.x - ux * back - uy * side, y: player.y - uy * back + ux * side }
  const right = { x: player.x - ux * back + uy * side, y: player.y - uy * back - ux * side }
  const extend = (p: Point) => ({ x: source.x + (p.x - source.x) * 60 / length, y: source.y + (p.y - source.y) * 60 / length })
  return { playerId: player.id, upper: player.y < 10, centre: { x: player.x, y: player.y }, radius, polygon: [left, extend(left), extend(right), right] }
}

export function coverageShadows(state: TacticsState, shot: Shot): CoverageShadow[] {
  const upper = state.ball.y < 10
  const reflect = (p: Point): Point => ({ x: 10 - p.x, y: 20 - p.y })
  const normalized: TacticsState = upper ? {
    ...state, ball: reflect(state.ball), target: reflect(state.target),
    players: state.players.map(p => ({ ...p, ...reflect(p), team: p.team === 'you' ? 'opponents' : 'you' })),
  } : state
  const normalizedShot = upper ? { ...shot, samples: shot.samples.map(p => ({ ...p, ...reflect(p) })) } : shot
  const contacts = possibleReturnContacts(normalized, normalizedShot)
  const earliest = contacts.reduce<(typeof contacts)[number] | undefined>((best, p) => !best || p.t < best.t ? p : best, undefined)
  // Without a reachable reply, the landing point provides a positional orientation
  // only. Coral means unscreened space, not a predicted winning return.
  const returnSource = earliest ? (upper ? reflect(earliest) : earliest) : state.target
  return state.players.map(player => playerShadow(player, (player.y < 10) === upper ? returnSource : state.ball))
}
