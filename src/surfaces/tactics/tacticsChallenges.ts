import { clamp, initialTactics, selectShooter } from './tacticsModel'
import type { Point, TacticsState } from './tacticsModel'

export type ChallengeMode = 'positioning' | 'placement'
export type TacticsMode = ChallengeMode | 'free'
export type TargetArea = { left: number; right: number; top: number; bottom: number }
export type TacticsChallenge = {
  id: string; title: string; prompt: string; tip: string; player: number
  state: TacticsState; area: TargetArea
}

function setup(positions: [number, number][], owner: number, kind: 'drive' | 'lob' = 'drive'): TacticsState {
  const state = initialTactics()
  state.players = state.players.map((p, i) => ({ ...p, x: positions[i]![0], y: positions[i]![1] }))
  return selectShooter({ ...state, kind, speed: kind === 'lob' ? 7 : 12 }, owner)
}

// Authored practice situations and generous club coaching zones, not win probabilities.
export const challenges: Record<ChallengeMode, TacticsChallenge[]> = {
  positioning: [
    { id: 'cover-middle', title: 'Cover your partner', prompt: 'Player 3 is pulled wide. Move player 4 across to cover the middle.',
      tip: 'Shift across with your partner so the middle stays covered.', player: 4,
      state: setup([[2.5, 6.8], [7.5, 6.8], [0.8, 16], [8.4, 16]], 1), area: { left: 4.6, right: 6.1, top: 15, bottom: 17 } },
    { id: 'take-net', title: 'Move up together', prompt: 'Your deep lob has pushed both opponents back. Bring player 3 up with player 4.',
      tip: 'Take the net together after a successful deep lob.', player: 3,
      state: setup([[2.5, 1.8], [7.5, 2], [2.6, 17], [7.4, 12.7]], 1), area: { left: 2, right: 3.5, top: 12, bottom: 13.5 } },
    { id: 'defend-together', title: 'Recover together', prompt: 'The opponents have the net; player 3 has retreated. Bring player 4 back into line.',
      tip: 'Defend at a similar depth and leave room for the back-glass rebound.', player: 4,
      state: setup([[2.6, 7.4], [7.4, 7.4], [2.8, 17], [7.3, 12]], 2), area: { left: 6.5, right: 8, top: 16, bottom: 17.6 } },
    { id: 'cover-other-side', title: 'Follow the play', prompt: 'Player 4 is pulled wide. Move player 3 across to protect the middle.',
      tip: 'Move as a pair rather than guarding only your usual side.', player: 3,
      state: setup([[2.5, 6.8], [7.5, 6.8], [1.5, 16], [9.2, 16]], 2), area: { left: 3.9, right: 5.4, top: 15, bottom: 17 } },
  ],
  placement: [
    { id: 'lob-left', title: 'Over the net players', prompt: 'Both opponents are at the net. Aim a deep lob behind player 1.',
      tip: 'Land the lob deep, with a safe margin from the glass.', player: 3,
      state: setup([[2.5, 7.8], [7.5, 7.8], [3, 17], [7.4, 17]], 3, 'lob'), area: { left: 1.2, right: 3.8, top: 1, bottom: 3 } },
    { id: 'open-right', title: 'Find the open side', prompt: 'Both opponents have shifted left. Place a controlled drive into the open right side.',
      tip: 'Use the open space and keep a margin inside the side glass.', player: 4,
      state: setup([[1.3, 3], [4, 3], [2.7, 12.5], [7.5, 12.5]], 4), area: { left: 7, right: 8.8, top: 2, bottom: 4.5 } },
    { id: 'lob-right', title: 'Make them retreat', prompt: 'The opponents are pressing the net. Aim a deep lob behind player 2.',
      tip: 'Height buys time; depth makes the opponent move away from the net.', player: 4,
      state: setup([[2.5, 7.8], [7.5, 7.8], [2.6, 17], [7, 17]], 4, 'lob'), area: { left: 6.2, right: 8.8, top: 1, bottom: 3 } },
    { id: 'open-left', title: 'Use the space', prompt: 'Both opponents have shifted right. Place a controlled drive into the open left side.',
      tip: 'Choose the open side without needing to paint the line.', player: 3,
      state: setup([[6, 3], [8.7, 3], [2.5, 12.5], [7.3, 12.5]], 3), area: { left: 1.2, right: 3, top: 2, bottom: 4.5 } },
  ],
}

export function challengeState(challenge: TacticsChallenge): TacticsState {
  return { ...challenge.state, players: challenge.state.players.map(p => ({ ...p })), ball: { ...challenge.state.ball }, target: { ...challenge.state.target } }
}

export function scorePlacement(point: Point, area: TargetArea) {
  const nearest = { x: clamp(point.x, area.left, area.right), y: clamp(point.y, area.top, area.bottom) }
  const metres = Math.hypot(point.x - nearest.x, point.y - nearest.y)
  // Full credit anywhere inside the zone. Smooth falloff, in court metres, outside it.
  return { score: Math.round(100 * Math.exp(-metres / 2.5)), metres, nearest }
}
