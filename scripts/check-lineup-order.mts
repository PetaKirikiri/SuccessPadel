import assert from 'node:assert/strict'
import { lineupSnapshot, moveLineupPlayer, nearestLineupSlot, occupantsInFixedSlots } from '../src/lib/competitionLineupOrder'
import type { CompetitionPlayer } from '../src/hooks/useCompetitions'

const slots = ['A', 'B', 'C', 'D'].map((name, rank_order) => ({
  id: `slot-${rank_order}`, rank_order, guest_name: name,
  profile_id: null, padel_player_id: `player-${name}`, guest_email: null,
})) as CompetitionPlayer[]
const moved = moveLineupPlayer(slots, 0, 2)
assert.deepEqual(moved.map(p => p.guest_name), ['B', 'C', 'A', 'D'])
assert.deepEqual(slots.map(p => p.guest_name), ['A', 'B', 'C', 'D'])
const saved = occupantsInFixedSlots(slots, moved)
assert.deepEqual(saved.map(p => p.id), slots.map(p => p.id))
assert.deepEqual(saved.map(p => p.rank_order), [0, 1, 2, 3])
assert.deepEqual(saved.map(p => p.padel_player_id), ['player-B', 'player-C', 'player-A', 'player-D'])
assert.deepEqual(lineupSnapshot(saved).map(p => p.id), slots.map(p => p.id))
assert.deepEqual(moveLineupPlayer(slots, -1, 0), slots)
assert.deepEqual(moveLineupPlayer(slots, 0, 4), slots)
// All positions, both columns, backwards/forwards and successive queued moves.
const sixteen = Array.from({ length: 16 }, (_, i) => ({ ...slots[0]!,
  id: `slot-${i}`, rank_order: i, guest_name: `Player ${i}`, padel_player_id: `player-${i}`,
}))
const rects = sixteen.map((_, i) => ({ left: (i % 2) * 210, right: (i % 2) * 210 + 200,
  top: Math.floor(i / 2) * 80, bottom: Math.floor(i / 2) * 80 + 70 }))
let previous = sixteen
for (let from = 0; from < 16; from++) {
  for (let to = 0; to < 16; to++) {
    const rect = rects[to]!
    assert.equal(nearestLineupSlot(rects, rect.left + 100, rect.top + 35), to)
    assert.equal(nearestLineupSlot(rects, rect.left + 100, rect.bottom + 2), to)
    const reordered = moveLineupPlayer(previous, from, to)
    const next = occupantsInFixedSlots(previous, reordered)
    assert.equal(next[to]!.padel_player_id, previous[from]!.padel_player_id)
    assert.deepEqual(next.map(p => p.id), sixteen.map(p => p.id))
    assert.deepEqual(next.map(p => p.rank_order), sixteen.map(p => p.rank_order))
    assert.equal(new Set(next.map(p => p.padel_player_id)).size, 16)
    previous = next
  }
}
assert.equal(nearestLineupSlot([], 0, 0), -1)
console.log('check:lineup-order ok')
