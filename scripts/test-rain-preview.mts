import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { buildRainSchedule } from '../src/surfaces/rain-test/rainSchedule'
import { rainStorageKey, readRainScores, saveRainScore } from '../src/surfaces/rain-test/rainScores'
import { loadFrozenRainDraw, RAIN_COMPETITION_ID } from '../src/surfaces/rain-test/frozenRainDraw'
import frozenDraw from '../src/surfaces/rain-test/rain-draw-2026-10-07.json'

const players = Array.from({ length: 12 }, (_, i) => ({ id: null, rosterId: String(i), name: `Player ${i + 1}`, avatarUrl: null }))
const rounds = buildRainSchedule(players)
assert.equal(rounds.length, 9)
assert.equal(rounds[0]!.startsAt, '18:15')
assert.equal(rounds.at(-1)!.endsAt, '19:53')
const seconds = (clock: string) => {
  const [h, m, s = 0] = clock.split(':').map(Number)
  return h! * 3600 + m! * 60 + s
}
const partners = new Set<string>()
for (const [index, round] of rounds.entries()) {
  assert.equal(round.game.courts.length, 2)
  assert.equal(round.resting.length, 4)
  const active = round.game.courts.flatMap(court => [...court.teamAPlayers!, ...court.teamBPlayers!])
  assert.equal(active.length, 8)
  assert.equal(new Set([...active, ...round.resting].map(p => p.rosterId)).size, 12)
  assert.equal(seconds(round.endsAt) - seconds(round.startsAt), 600)
  if (index) assert.equal(seconds(round.startsAt) - seconds(rounds[index - 1]!.endsAt), 60)
  for (const court of round.game.courts) {
    for (const pair of [court.teamAPlayers!, court.teamBPlayers!]) {
      const key = pair.map(p => p.rosterId).sort().join(':')
      assert(!partners.has(key), `Repeated partnership ${key}`)
      partners.add(key)
    }
  }
}
for (const player of players) {
  const rest = rounds.map(round => round.resting.some(p => p.rosterId === player.rosterId))
  assert.equal(rest.filter(Boolean).length, 3)
  for (let i = 0; i < rest.length - 2; i++) assert.equal(rest.slice(i, i + 3).filter(Boolean).length, 1)
}
assert.throws(() => buildRainSchedule(players.slice(0, 8)))
assert.throws(() => buildRainSchedule([...players.slice(0, 11), players[0]!]))
console.log('Rain preview: 9 ten-minute rounds, 60-second changeovers, 19:53 finish; 6 games and 3 rests each; no repeated partners.')

const values = new Map<string, string>()
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
const key = rainStorageKey('test-event', rounds)
assert.deepEqual(rounds[0]!.game.courts.map(c => c.courtLabel), ['Court 3', 'Court 4'])
const previousLabels = rounds.map(round => ({ ...round, game: { ...round.game, courts: round.game.courts.map((court, index) => ({ ...court, courtLabel: `Court ${index + 1}` })) } }))
assert.equal(key, rainStorageKey('test-event', previousLabels), 'Relabeling courts must retain the same saved scores')
const previousTimes = rounds.map((round, index) => ({ ...round,
  startsAt: String(index), endsAt: String(index + 1),
  game: { ...round.game, timeLabel: 'Previous timing' },
}))
assert.equal(key, rainStorageKey('test-event', previousTimes), 'Timing changes must retain saved scores and pending offline edits')
saveRainScore(storage, key, 1, 'rain-court-1', { teamAPoints: 4, teamBPoints: 2 })
saveRainScore(storage, key, 1, 'rain-court-2', { teamAPoints: 0, teamBPoints: 0 })
saveRainScore(storage, key, 2, 'rain-court-1', { teamAPoints: 3, teamBPoints: 1 })
saveRainScore(storage, key, 1, 'rain-court-1', { teamAPoints: 5, teamBPoints: 2 })
assert.deepEqual(readRainScores(storage.getItem(key)), {
  '1:rain-court-1': { teamAPoints: 5, teamBPoints: 2 },
  '1:rain-court-2': { teamAPoints: 0, teamBPoints: 0 },
  '2:rain-court-1': { teamAPoints: 3, teamBPoints: 1 },
})
assert.notEqual(key, rainStorageKey('another-event', rounds))
assert.notEqual(key, rainStorageKey('test-event', buildRainSchedule([...players].reverse())))
assert.throws(() => saveRainScore(storage, key, 1, 'rain-court-1', { teamAPoints: -1, teamBPoints: 2 }))
assert.throws(() => saveRainScore(storage, key, 1, 'rain-court-1', { teamAPoints: 1.5, teamBPoints: 2 }))
assert.throws(() => saveRainScore(storage, key, 1, 'rain-court-1', { teamAPoints: 100, teamBPoints: 2 }))
assert.throws(() => readRainScores('broken'))
assert.throws(() => readRainScores('{"unexpected":{}}'))
assert.throws(() => saveRainScore({ getItem: () => null, setItem: () => { throw new Error('Quota exceeded') } }, key, 1, 'rain-court-1', { teamAPoints: 1, teamBPoints: 2 }))
console.log('Rain scores: persistence, edits, zero scores, court/round/draw isolation, invalid data and storage failures passed.')

const frozen = loadFrozenRainDraw()
const sourcePlayers = frozenDraw.players.map(p => ({ ...p, id: p.id ?? null, avatarUrl: p.avatarUrl ?? null }))
const formerGenerated = buildRainSchedule(sourcePlayers)
const withoutTimes = (items: typeof frozen) => items.map(r => ({ resting: r.resting, courts: r.game.courts.map(({ timeLabel, ...court }) => court) }))
assert.deepEqual(withoutTimes(frozen), withoutTimes(formerGenerated), 'Delay must preserve every pairing, court, rest and player position')
assert.equal(frozen[2]!.startsAt, '18:46:48')
assert.equal(frozen.at(-1)!.endsAt, '20:02:48')
for (let i = 2; i < frozen.length; i++) {
  assert.equal(seconds(frozen[i]!.endsAt) - seconds(frozen[i]!.startsAt), 600)
  if (i > 2) assert.equal(seconds(frozen[i]!.startsAt) - seconds(frozen[i - 1]!.endsAt), 60)
}
assert.equal(rainStorageKey(RAIN_COMPETITION_ID, frozen), rainStorageKey(RAIN_COMPETITION_ID, formerGenerated), 'Existing score storage must remain addressable')
const previewSource = readFileSync('src/surfaces/rain-test/RainModePreview.tsx', 'utf8')
assert(!previewSource.includes('buildRainSchedule'), 'The active page must not regenerate the assigned draw')
assert(!previewSource.includes('list_competitions_for_setup'), 'Attendance changes must not replace the assigned draw')
const frozenFingerprint = createHash('sha256').update(JSON.stringify({ players: frozenDraw.players.map(p => [p.name, p.rosterId]), courtLabels: frozenDraw.courtLabels, courtIds: frozenDraw.courtIds, rounds: frozenDraw.rounds })).digest('hex')
assert.equal(frozenFingerprint, '1264fe24166d565f51ffaff16cc5b9bf50ea502090e213277f373d56c1b9ffe2', 'Assigned 7 October rain draw with approved changeovers is locked; do not silently reshuffle it')
console.log('Frozen draw fingerprint:', frozenFingerprint)
