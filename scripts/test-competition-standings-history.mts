import assert from 'node:assert/strict'
import { competitionStandingsHistory } from '../src/lib/competitionStandingsHistory'
import type { CompetitionPlayer } from '../src/hooks/useCompetitions'
import type { CompetitionRound, CourtMatch } from '../src/hooks/useCompetitionRun'

const roster = ['a','b','c','d'].map(id => ({ id, padel_player_id: id, profile_id: null, guest_name: id, profiles: null })) as CompetitionPlayer[]
const rounds = [1,2,3].map(n => ({ id: `r${n}`, round_number: n,
  competition_round_players: roster.map((p,i) => ({ roster_entry_id: p.id, padel_player_id: p.id,
    profile_id: null, court_id: 'court', team: i < 2 ? 'a' : 'b', session_players: null, courts: null })),
})) as CompetitionRound[]
const matches = ['4-2','0-6','9-0'].map((score_summary,i) => ({ competition_round_id: `r${i+1}`,
  court_id: 'court', score_summary, match_players: roster.map((p,i) => ({
    padel_player_id: p.id, team: i < 2 ? 'a' : 'b', is_winner: false,
  })),
})) as CourtMatch[]
const original = JSON.stringify({roster,rounds,matches})
const first = competitionStandingsHistory(roster,rounds,matches,1)!
assert.deepEqual(first.movement,{})
assert.equal(first.entries[0].total_points,4)
const second = competitionStandingsHistory(roster,rounds,matches,2)!
assert.equal(second.entries[0].total_points,8,'Future results excluded')
assert.equal(second.movement.c,2)
assert.equal(second.movement.a,-2)
assert.deepEqual(competitionStandingsHistory(roster,rounds,matches,2),second,'Independent of navigation/cache')
assert.equal(JSON.stringify({roster,rounds,matches}),original,'Inputs remain untouched')
const changed = structuredClone(rounds)
changed[0].competition_round_players.reverse()
changed[0].competition_round_players.forEach(p => { p.team = p.team === 'a' ? 'b' : 'a' })
assert.deepEqual(competitionStandingsHistory(roster,changed,matches,2),second,'Saved participants override edited lineup')
const unknown = structuredClone(matches)
unknown[0].match_players[0].padel_player_id = 'not-on-roster'
assert.equal(competitionStandingsHistory(roster,rounds,unknown,2),null,'Never assign unknown historical player points to replacement')
const duo = competitionStandingsHistory(roster,rounds,matches,2,[
  {label:'Team 1',roster_ids:['a','b']}, {label:'Team 2',roster_ids:['c','d']},
])!
assert.equal(duo.entries.length,2)
assert.equal(duo.entries[0].total_points,8,'Pair total counted once')
assert.equal(duo.movement['duo:c:d'],1)
assert.equal(duo.movement['duo:a:b'],-1)
assert.deepEqual(competitionStandingsHistory(roster,rounds,[],2)!.movement,{})
console.log('History passed: cutoff, ties, up/down, refresh, saved identities, duos, no results and immutable inputs.')
