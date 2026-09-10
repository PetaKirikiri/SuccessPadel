import type { CompetitionPlayer } from '../hooks/useCompetitions'

/** Geometric targets include the gaps; floating cards must not occlude targets. */
export function nearestLineupSlot(rects: { left: number; right: number; top: number; bottom: number }[], x: number, y: number) {
  let nearest = -1
  let distance = Infinity
  rects.forEach((rect, index) => {
    const dx = Math.max(rect.left - x, 0, x - rect.right)
    const dy = Math.max(rect.top - y, 0, y - rect.bottom)
    const next = dx * dx + dy * dy
    if (next < distance) { distance = next; nearest = index }
  })
  return nearest
}

export function moveLineupPlayer<T>(players: T[], from: number, to: number): T[] {
  const next = [...players]
  if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next
  const [player] = next.splice(from, 1)
  next.splice(to, 0, player!)
  return next
}

export function lineupSnapshot(players: CompetitionPlayer[]) {
  return players.map((player) => ({
    id: player.id,
    profile_id: player.profile_id ?? null,
    padel_player_id: player.padel_player_id ?? null,
    guest_name: player.guest_name ?? null,
    guest_email: player.guest_email ?? null,
    rank_order: player.rank_order,
  }))
}

/** Occupants move; the fixed slot IDs used by the saved match plan do not. */
export function occupantsInFixedSlots(slots: CompetitionPlayer[], occupants: CompetitionPlayer[]) {
  return occupants.map((player, index) => ({
    ...player,
    id: slots[index]!.id,
    rank_order: slots[index]!.rank_order,
  }))
}
