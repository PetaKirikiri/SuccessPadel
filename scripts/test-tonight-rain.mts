import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { unpackRainDraw, rainReturnTime, type RainDrawRecord } from '../src/surfaces/rain-test/rainDraw'
import { RainScoreSync, type OnlineRainScore } from '../src/surfaces/rain-test/rainScoreSync'
import { rainStandings } from '../src/surfaces/rain-test/rainStandings'
import { displayGames } from '../public/rain-guide/schedule.mjs'

const draw = JSON.parse(readFileSync('src/surfaces/rain-test/rain-draw-2026-10-28.json', 'utf8'))
const record: RainDrawRecord = {session_id: draw.competitionId, fingerprint: 'a'.repeat(64), active: true, draw}
const rounds = unpackRainDraw(record)
assert.equal(rounds.length, 10)
assert.equal(rounds[0]!.startsAt, '18:10')
assert.equal(rounds[9]!.endsAt, '19:59')
assert.deepEqual(draw.rounds.map((r: any) => r.courts.map((c: string[][]) => c.map(t => t.map(n => draw.players.findIndex((p: any) => p.name === n) + 1)))), displayGames)
for (const player of draw.players) {
  const partners = new Set<string>(), courts = new Set<number>()
  let games = 0, streak = 0, last = false
  for (const round of draw.rounds) {
    let playing = false
    round.courts.forEach((teams: string[][], court: number) => teams.forEach(team => {
      if (team.includes(player.name)) { games++; playing = true; courts.add(court); partners.add(team.find(n => n !== player.name)!) }
    }))
    streak = playing === last ? streak + 1 : 1
    assert(streak <= 2, `${player.name} consecutive play/rest`)
    last = playing
  }
  assert.equal(games, 5); assert.equal(partners.size, 5); assert.equal(courts.size, 1)
}
for (let i = 1; i < 10; i++) for (let c = 0; c < 2; c++) {
  const before = draw.rounds[i-1].courts[c].flat()
  const staying = draw.rounds[i].courts[c].flat().filter((n: string) => before.includes(n))
  assert.equal(staying.length, i === 9 ? 0 : 2)
}
assert.equal(rainReturnTime(rounds, 0, draw.players[8].rosterId), '18:21')
assert.equal(rainReturnTime(rounds, 0, draw.players[12].rosterId), '18:32')
assert.equal(rainReturnTime(rounds, 9, draw.players[0].rosterId), null)
const invalid = structuredClone(record)
invalid.draw.rounds[0]!.courts[0]![0]![0] = invalid.draw.rounds[0]!.courts[0]![0]![1]!
assert.throws(() => unpackRainDraw(invalid), /duplicated/)
const values = new Map<string,string>()
const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => {values.set(k,v)} }
const rows: OnlineRainScore[] = Array.from({length:20},(_,i)=>({game_number:Math.floor(i/2)+1,court_slot:i%2+1,team_a:null,team_b:null,revision:0}))
let offline = false
const remote = {
  async read() { if (offline) throw Error('Offline'); return structuredClone(rows) },
  async save(key: string, edit: any) {
    if (offline) throw Error('Offline')
    const row = rows.find(r => key === `${r.game_number}:rain-court-${r.court_slot}`)!
    Object.assign(row, {team_a: edit.score.teamAPoints, team_b: edit.score.teamBPoints, revision: row.revision+1})
    return {...row}
  },
}
const sync = new RainScoreSync(storage,'tonight',remote,()=>{},10)
await sync.sync(); assert(sync.view().ready)
offline = true
sync.edit('10:rain-court-2',{teamAPoints:5,teamBPoints:3})
await sync.sync()
const restored = new RainScoreSync(storage,'tonight',remote,()=>{},10)
assert.equal(restored.view().scores['10:rain-court-2']!.teamAPoints,5)
offline = false; await restored.sync()
assert.equal(rows[19]!.team_a,5)
assert.equal(rows[18]!.team_a,null)
const standings = rainStandings(rounds,restored.view().scores)
assert.equal(standings.length,16)
assert.equal(standings.filter(p=>p.games===1).length,4)
assert.equal(standings.reduce((n,p)=>n+p.total_points,0),16)
const incomplete = new RainScoreSync(storage,'incomplete',{...remote,read:async()=>rows.slice(0,18)},()=>{},10)
await incomplete.sync(); assert(!incomplete.view().ready)
console.log('Tonight rain passed: exact approved draw, 16 identities, 5 games/partners each, same courts, rotation, return times, round 10 offline score recovery and standings.')
