import assert from 'node:assert/strict'
import { readMovementSnapshot, updateMovement, movementEntryId } from '../src/lib/leaderboardMovement'
import type { LeaderboardEntry } from '../src/lib/leaderboardTypes'

for (const prefix of ['player:', 'duo:']) {
  const row = (id: string, points: number): LeaderboardEntry => ({
    profile_id: prefix + id, display_name: id, total_points: points, games: 1,
  })
  const initial = [row('a', 6), row('b', 4), row('c', 2)]
  const original = JSON.stringify(initial)
  const baseline = updateMovement(null, initial)!
  assert.deepEqual(Object.values(baseline.movement), [0, 0, 0], 'First load has no invented movement')
  const changed = [row('c', 8), row('a', 6), row('b', 4)]
  const moved = updateMovement(baseline, changed)!
  assert.equal(moved.movement[prefix + 'c'], 2)
  assert.equal(moved.movement[prefix + 'a'], -1)
  assert.equal(moved.movement[prefix + 'b'], -1)
  const restored = readMovementSnapshot(JSON.stringify(moved))!
  assert.equal(updateMovement(restored, changed), restored, 'Refresh keeps movement, does not count again')
  assert.equal(updateMovement(moved, changed.map(e => ({ ...e, display_name: 'Renamed', avatar_url: 'photo' }))), moved)
  assert.equal(updateMovement(moved, []), moved, 'Loading does not destroy the baseline')
  const unchangedRanks = updateMovement(moved, [row('c', 9), row('a', 6), row('b', 4)])!
  assert.deepEqual(Object.values(unchangedRanks.movement), [0, 0, 0], 'Next score clears stale arrows')
  const corrected = updateMovement(moved, initial)!
  assert.equal(corrected.movement[prefix + 'c'], -2, 'Score corrections can move down')
  const tied = updateMovement(baseline, [row('b', 6), row('a', 6), row('c', 2)])!
  assert.equal(tied.movement[prefix + 'b'], 1)
  assert.equal(tied.movement[prefix + 'a'], 0, 'Use displayed tied rank, not array position')
  assert.deepEqual(Object.values(updateMovement(moved, [...changed, row('d', 0)])!.movement), [0, 0, 0, 0])
  assert.equal(JSON.stringify(initial), original, 'Scoring input is never modified')
}
assert.equal(movementEntryId({ profile_id: 'new-account', roster_entry_id: 'same-slot' } as LeaderboardEntry), 'same-slot')
for (const bad of [null, 'oops', '{}', '{"version":1,"scores":"","ranks":[],"movement":{}}']) assert.equal(readMovementSnapshot(bad), null)
console.log('Rank movement passed: singles/duos, up/down, ties, corrections, refresh, metadata, loading, roster changes, immutable scores.')
