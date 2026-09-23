import assert from 'node:assert/strict'
import { coachGameLineup, initialCoachRound, coachCompetitionFromPath, type CoachPlayer } from '../src/lib/coachGameLineup'
import type { CompetitionRound, RoundPlayer } from '../src/hooks/useCompetitionRun'
const players = Array.from({ length: 16 }, (_, i): CoachPlayer => ({ id: `slot-${i}`, playerId: `player-${i}`, profileId: null, name: i < 2 ? 'Jo' : `Player ${i}`, avatarUrl: null }))
const slot = (i: number, court: number, team: 'a'|'b'): RoundPlayer => ({ roster_entry_id: players[i].id, padel_player_id: players[i].playerId, profile_id: null, court_id: `court-${court}`, team, session_players: null, courts: null })
const round: CompetitionRound = { id: 'round-1', session_id: 'competition', round_number: 1, is_final: false, status: 'pending', starts_at: '2026-09-23T11:10:00Z', ends_at: '2026-09-23T11:25:00Z', competition_round_players: Array.from({ length: 16 }, (_, i) => slot(i, Math.floor(i / 4), i % 4 < 2 ? 'a' : 'b')) }
const courts = Array.from({ length: 4 }, (_, i) => ({ id: `court-${i}`, name: `Court ${i + 1}`, sort_order: i }))
const before = JSON.stringify(round)
for (const count of [12, 16]) {
 const result = coachGameLineup({ ...round, competition_round_players: round.competition_round_players.slice(0, count) }, players.slice(0, count), courts)
 assert.equal(result.courts.length, count / 4)
 assert.equal(result.unassigned.length, 0)
 assert.deepEqual(result.courts[0].a.map(p => p.id), ['slot-0', 'slot-1'])
 assert.deepEqual(result.courts[0].b.map(p => p.id), ['slot-2', 'slot-3'])
}
assert.equal(JSON.stringify(round), before, 'never mutate saved assignments')
const swapped = { ...round, competition_round_players: round.competition_round_players.map(p => ({ ...p, court_id: p.court_id === 'court-0' ? 'court-2' : p.court_id === 'court-2' ? 'court-0' : p.court_id })) }
assert.equal(coachGameLineup(swapped, players, courts).courts[0].a[0].id, 'slot-8', 'follow persisted court swaps')
assert.equal(coachGameLineup(undefined, players, courts).unassigned.length, 16)
const missing = { ...round, competition_round_players: [slot(0, 0, 'a'), slot(0, 1, 'b'), { ...slot(1, 0, 'b'), roster_entry_id: 'old-slot' }] }
const result = coachGameLineup(missing, players, courts)
assert.equal(result.courts[0].a.length, 1, 'duplicate slot never duplicated')
assert.equal(result.courts[0].b[0].id, 'slot-1', 'stable player identity resolves stale roster ID')
assert.equal(result.unassigned.length, 14)
assert.equal(coachGameLineup({ ...round, competition_round_players: [{ ...slot(1, 0, 'a'), roster_entry_id: 'unknown', padel_player_id: null }] }, players, courts).courts.length, 0, 'never match by duplicate names')
const next = { ...round, id: 'round-2', round_number: 2, starts_at: '2026-09-23T11:29:00Z', ends_at: '2026-09-23T11:44:00Z' }
assert.equal(initialCoachRound([next, round], null, Date.parse('2026-09-23T11:20:00Z')), 'round-1')
assert.equal(initialCoachRound([round, next], null, Date.parse('2026-09-23T11:27:00Z')), 'round-2')
assert.equal(initialCoachRound([round, next], 1, Date.parse('2026-09-23T11:40:00Z')), 'round-1')
const id = '75374dd0-9707-4a06-a578-ffbe142adcf4'
assert.equal(coachCompetitionFromPath(`/competitive?competition=${id}`), id)
assert.equal(coachCompetitionFromPath(`/competitions/${id}`), id)
assert.equal(coachCompetitionFromPath('//untrusted.example/'), null)
assert.equal(coachCompetitionFromPath('/players/someone'), null)
console.log('Coach lineup: 12/16 players, saved teams/courts, missing/duplicate identities, round selection and profile context passed.')
