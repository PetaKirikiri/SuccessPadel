import type { GameSession, PlayerCapMode } from './types'

export function rosterLabel(current: number, target: number, flexible: boolean): string {
  const label = `${current}/${target}`
  if (flexible && current > target) return `${label}+`
  return label
}

export function isOverflow(current: number, target: number): boolean {
  return current > target
}

export function canJoinGame(
  session: Pick<GameSession, 'player_cap_mode' | 'max_players' | 'target_players' | 'status' | 'visibility'>,
  rosterCount: number,
): boolean {
  if (session.status !== 'open' || session.visibility !== 'open') return false
  if (session.player_cap_mode === 'flexible') return true
  const cap = session.max_players ?? session.target_players ?? 4
  return rosterCount < cap
}

export function canJoinSlot(slotPlayerCount: number): boolean {
  return slotPlayerCount < 4
}

export function capModeLabel(mode: PlayerCapMode | null | undefined): string {
  return mode === 'flexible' ? 'Flexible' : 'Strict'
}
