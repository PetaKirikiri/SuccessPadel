import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameCountdownUrgency } from '../src/lib/gameCountdownUrgency.ts'

test('round-relative urgency resets and works with different saved durations', () => {
  for (const minutes of [13, 15, 20]) {
    const start = 1_000_000
    const end = start + minutes * 60_000
    assert.equal(gameCountdownUrgency(start - 60_000, start, end), 0)
    assert.equal(gameCountdownUrgency(start, start, end), 0)
    assert.equal(gameCountdownUrgency(start + (end - start) / 2, start, end), 10)
    assert.equal(gameCountdownUrgency(end, start, end), 20)
    assert.equal(gameCountdownUrgency(end + 1000, start, end), 20)
    assert.equal(gameCountdownUrgency(end, end, end + 240_000), 0)
  }
})
test('invalid timing stays neutral instead of inventing an urgent state', () => {
  assert.equal(gameCountdownUrgency(100, 200, 200), 0)
  assert.equal(gameCountdownUrgency(100, 200, 150), 0)
  assert.equal(gameCountdownUrgency(NaN, 100, 200), 0)
})
