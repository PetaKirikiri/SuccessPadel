import assert from 'node:assert/strict'
import { readRainViewedGame, saveRainViewedGame } from '../src/surfaces/rain-test/rainViewedGame'

const values = new Map<string, string>()
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
assert.equal(readRainViewedGame('tonight', 9, storage), 0)
for (const index of [0, 3, 8]) {
  saveRainViewedGame('tonight', index, 9, storage)
  assert.equal(readRainViewedGame('tonight', 9, storage), index)
}
assert.equal(readRainViewedGame('another-event', 9, storage), 0)
assert.equal(readRainViewedGame('tonight', 6, storage), 0)
const key = [...values.keys()][0]!
for (const value of ['bad', '', '-1', '0', '10', '3.5', 'Infinity']) {
  values.set(key, value)
  assert.equal(readRainViewedGame('tonight', 9, storage), 0)
}
saveRainViewedGame('tonight', 4, 9, storage)
for (const index of [-1, 9, NaN, 2.5]) saveRainViewedGame('tonight', index, 9, storage)
assert.equal(readRainViewedGame('tonight', 9, storage), 4)
const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
assert.equal(readRainViewedGame('tonight', 9, blocked), 0)
assert.doesNotThrow(() => saveRainViewedGame('tonight', 4, 9, blocked))
assert.equal(values.size, 1)
console.log('Rain viewed game: refresh restoration, event isolation, invalid values and unavailable storage passed.')
