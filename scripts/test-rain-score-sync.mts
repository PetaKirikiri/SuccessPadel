import assert from 'node:assert/strict'
import { RainScoreSync, type OnlineRainScore, type RainScoreRemote } from '../src/surfaces/rain-test/rainScoreSync'
import { rainStandings } from '../src/surfaces/rain-test/rainStandings'
import { loadFrozenRainDraw } from '../src/surfaces/rain-test/frozenRainDraw'

const values = new Map<string, string>()
const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } }
const rows: OnlineRainScore[] = Array.from({ length: 18 }, (_, i) => ({ game_number: Math.floor(i / 2) + 1, court_slot: i % 2 + 1, team_a: null, team_b: null, revision: 0 }))
let offline = false
let loseResponse = false
const remote: RainScoreRemote = {
  async read() { if (offline) throw new Error('Offline'); return structuredClone(rows) },
  async save(key, edit) {
    if (offline) throw new Error('Offline')
    const [game, court] = key.split(':')
    const row = rows.find(r => r.game_number === Number(game) && r.court_slot === Number(court!.slice(-1)))!
    if (row.revision !== edit.revision) {
      if (row.team_a === edit.score.teamAPoints && row.team_b === edit.score.teamBPoints) return { ...row }
      throw Object.assign(new Error('Conflict'), { code: '40001' })
    }
    row.team_a = edit.score.teamAPoints; row.team_b = edit.score.teamBPoints; row.revision++
    if (loseResponse) { loseResponse = false; throw new Error('Response lost') }
    return { ...row }
  },
}
const sync = new RainScoreSync(storage, 'test', remote, () => {})
await sync.sync()
assert(sync.view().ready)
assert.deepEqual(sync.view().scores, {}, 'Empty matches are not recorded draws')
sync.edit('1:rain-court-1', { teamAPoints: 4, teamBPoints: 2 })
sync.edit('1:rain-court-1', { teamAPoints: 5, teamBPoints: 2 })
await sync.sync()
assert.equal(rows[0]!.team_a, 5, 'Rapid edits save the final value')
assert.equal(rows[1]!.team_a, null, 'Other court unchanged')
assert.equal(sync.view().status, 'All scores saved online')
offline = true
sync.edit('2:rain-court-2', { teamAPoints: 3, teamBPoints: 1 })
await sync.sync()
assert(sync.view().status.includes('Connection interrupted'))
const restored = new RainScoreSync(storage, 'test', remote, () => {})
assert.equal(restored.view().scores['2:rain-court-2']!.teamAPoints, 3, 'Outbox survives reload')
offline = false
await restored.sync()
assert.equal(rows[3]!.team_a, 3)
assert.equal(restored.view().status, 'All scores saved online')
// A new device changes the score after we last read it.
rows[0]!.team_a = 6; rows[0]!.revision++
restored.edit('1:rain-court-1', { teamAPoints: 2, teamBPoints: 2 })
await restored.sync()
assert.equal(rows[0]!.team_a, 6, 'Stale device cannot overwrite another device')
assert.deepEqual(restored.view().conflicts, ['1:rain-court-1'])
restored.resolve('1:rain-court-1', false)
await restored.sync()
assert.equal(restored.view().scores['1:rain-court-1']!.teamAPoints, 6)
loseResponse = true
restored.edit('3:rain-court-1', { teamAPoints: 1, teamBPoints: 4 })
await restored.sync()
const revision = rows[4]!.revision
await restored.sync()
assert.equal(rows[4]!.revision, revision, 'Lost acknowledgments are idempotent')
assert.equal(restored.view().status, 'All scores saved online')

const rounds = loadFrozenRainDraw()
const ledger = { '1:rain-court-1': { teamAPoints: 4, teamBPoints: 2 } }
const standings = rainStandings(rounds, ledger)
assert.equal(standings.length, 12)
assert.equal(standings.reduce((sum, p) => sum + p.total_points, 0), 12)
assert.equal(standings.filter(p => p.games === 1).length, 4)
assert.equal(standings.filter(p => p.games === 0).length, 8)
ledger['1:rain-court-1'] = { teamAPoints: 5, teamBPoints: 2 }
assert.equal(rainStandings(rounds, ledger).reduce((sum, p) => sum + p.total_points, 0), 14, 'Edit replaces, never adds another result')
assert.equal(rainStandings(rounds, {}).reduce((sum, p) => sum + p.games, 0), 0)
console.log('Rain sync passed: rapid edits, reload, offline recovery, conflicts, lost acknowledgments, isolated courts and leaderboard recalculation.')
