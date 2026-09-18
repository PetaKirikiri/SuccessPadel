import assert from 'node:assert/strict'
import { courtGameScoreOptions } from '../src/lib/competitionScoreInput'
assert.deepEqual(courtGameScoreOptions(8), [0, 1, 2, 3, 4, 5, 6, 7, 8])
assert.deepEqual(courtGameScoreOptions(7), [0, 1, 2, 3, 4, 5, 6, 7])
assert.deepEqual(courtGameScoreOptions(6), [0, 1, 2, 3, 4, 5, 6])
for (const limit of [undefined, 99, NaN, -1, 6.5]) {
  assert.deepEqual(courtGameScoreOptions(limit), [0, 1, 2, 3, 4, 5, 6])
}
console.log('Configured eight-game cap and six-game fallback passed')
