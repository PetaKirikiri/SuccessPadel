import type { CompetitionPlayer } from '../hooks/useCompetitions'

/** Geometric targets include the gaps; floating cards must not occlude targets. */
export function nearestLineupSlot(rects: { left: number; right: number; top: number; bottom: number }[], x: number, y: number, allowed?: readonly number[]) {
  let nearest = -1
  let distance = Infinity
  rects.forEach((rect, index) => {
    if (allowed && !allowed.includes(index)) return
    const dx = Math.max(rect.left - x, 0, x - rect.right)
    const dy = Math.max(rect.top - y, 0, y - rect.bottom)
    const next = dx * dx + dy * dy
    if (next < distance) { distance = next; nearest = index }
  })
  return nearest
}

/** Undefined means unrestricted. Invalid mixed groups fail closed. */
export function lineupLaneIndices(slots: { id: string }[], from: number, groups?: readonly (readonly string[])[]): number[] | undefined {
  if (groups === undefined) return undefined
  const ids = groups.flat()
  if (groups.length !== 2 || groups.some(group => !group.length) ||
      ids.length !== slots.length || new Set(ids).size !== ids.length ||
      !slots.every(slot => ids.includes(slot.id))) return []
  const lane = groups.find(group => group.includes(slots[from]?.id))
  return lane ? slots.flatMap((slot, index) => lane.includes(slot.id) ? [index] : []) : []
}

export function moveLineupPlayer<T>(players: T[], from: number, to: number, allowed?: readonly number[]): T[] {
  const next = [...players]
  if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next
  if (allowed) {
    if (!allowed.includes(from) || !allowed.includes(to)) return next
    // Move only this lane's occupants, even when its slots are interleaved.
    const reordered = moveLineupPlayer(allowed.map(index => players[index]!), allowed.indexOf(from), allowed.indexOf(to))
    allowed.forEach((index, position) => { next[index] = reordered[position]! })
    return next
  }
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
