import assert from 'node:assert/strict'
import { scheduledTvGame } from '../src/lib/scheduledTvGame'
const times = new Map([[1, { startsAt: 100, endsAt: 200 }], [2, { startsAt: 250, endsAt: 350 }], [3, { startsAt: 400, endsAt: 500 }]])
const games = [1, 2, 3]
assert.equal(scheduledTvGame('tv', 99, games, times), undefined)
assert.equal(scheduledTvGame('tv', 100, games, times), 1)
assert.equal(scheduledTvGame('tv', 249, games, times), 1)
assert.equal(scheduledTvGame('tv', 250, games, times), 2)
assert.equal(scheduledTvGame('tv', 450, games, times), 3)
assert.equal(scheduledTvGame('tv', 900, games, times), 3)
for (const viewport of ['mobile', 'tablet', 'web'] as const) {
  assert.equal(scheduledTvGame(viewport, 250, games, times), undefined)
}
assert.equal(scheduledTvGame('tv', 250, games), undefined)
assert.equal(scheduledTvGame('tv', 250, [1], times), 1)
console.log('TV start boundaries, breaks, wake-up catch-up, final game, and non-TV isolation passed')
