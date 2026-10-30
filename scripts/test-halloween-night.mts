import assert from 'node:assert/strict'
import { halloweenRounds } from '../src/lib/halloweenNight'
const partners = Array.from({length:16}, () => new Set<number>())
for (const round of halloweenRounds) {
 assert.equal(new Set(round.courts.flat()).size,16)
 for(const [a,b,c,d] of round.courts){assert.ok(a<8&&c<8&&b>=8&&d>=8);partners[a].add(b);partners[b].add(a);partners[c].add(d);partners[d].add(c)}
}
assert.ok(partners.every(p=>p.size===8));assert.equal(halloweenRounds[0].start,'19:03');assert.equal(halloweenRounds[7].end,'21:00')
console.log('Halloween: 16 players each round, mixed teams, eight unique partners each, 19:03–21:00.')

// Linked pages read saved identities/courts/times even when they differ from the announcement.
import { halloweenSavedPlan } from '../src/lib/halloweenSavedPlan'
import type { GameSession } from '../src/lib/types'
import type { CompetitionPlayer } from '../src/hooks/useCompetitions'
import type { CompetitionRound } from '../src/hooks/useCompetitionRun'
const roster=Array.from({length:4},(_,i)=>({id:`p${i}`})) as CompetitionPlayer[]
const round={round_number:1,starts_at:'2026-10-31T19:07:00+07:00',ends_at:'2026-10-31T19:19:00+07:00',competition_round_players:roster.map((p,i)=>({roster_entry_id:p.id,court_id:'court4',team:i<2?'a':'b'}))} as CompetitionRound
const saved=halloweenSavedPlan({} as GameSession,roster,[round],[{id:'court4',name:'Court 4',sort_order:1}])
assert.equal(saved[0].start,'19:07');assert.equal(saved[0].end,'19:19');assert.equal(saved[0].labels[0],'Court 4')
assert.deepEqual(saved[0].courts[0],[0,1,2,3])
assert.throws(()=>halloweenSavedPlan({} as GameSession,roster,[{...round,competition_round_players:[]}],[]),/incomplete/)
