import assert from 'node:assert/strict'
import { competitionReviewUrl } from '../src/lib/competitionReviewLink'
import { buildCompetitionReview, competitionReviewAvailable, reviewPlayerSummary, reviewRosterIdsForEntry } from '../src/lib/competitionReview'
import type { GameSession } from '../src/lib/types'
import type { CompetitionPlayer, CompetitionSessionPair } from '../src/hooks/useCompetitions'
import type { CompetitionRound, CourtMatch } from '../src/hooks/useCompetitionRun'

const session = { id: 'event', status: 'complete', scoring_config: {}, partnership_mode: 'rotating' } as GameSession
const reviewLink = new URL(competitionReviewUrl('event-1', 'player & 2'))
assert.equal(reviewLink.origin, 'https://successpadel.app')
assert.equal(reviewLink.searchParams.get('view'), 'review')
assert.equal(reviewLink.searchParams.get('competition'), 'event-1')
assert.equal(reviewLink.searchParams.get('player'), 'player & 2')
assert.notEqual(competitionReviewUrl('event-1', 'a'), competitionReviewUrl('event-1', 'b'))
assert.notEqual(competitionReviewUrl('event-1', 'a'), competitionReviewUrl('event-2', 'a'))
const roster = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, padel_player_id: id, profile_id: null, guest_name: `Player ${i + 1}`, rank_order: i, profiles: null })) as CompetitionPlayer[]
const round = (id: string, n: number, sides: string[][]): CompetitionRound => ({
  id, session_id: 'event', round_number: n, status: 'complete', is_final: false, starts_at: '', ends_at: '',
  competition_round_players: sides.flatMap((ids, side) => ids.map(id => ({ roster_entry_id: id, padel_player_id: id, profile_id: null, court_id: 'court', team: side ? 'b' : 'a', session_players: null, courts: null }))),
})
const rounds = [round('r1', 1, [['a', 'b'], ['c', 'd']]), round('r2', 2, [['a', 'c'], ['b', 'd']]), round('r3', 3, [['a', 'd'], ['b', 'c']])]
const matches: CourtMatch[] = [{ competition_round_id: 'r1', court_id: 'court', score_summary: '6-3', match_players: [] }, { competition_round_id: 'r2', court_id: 'court', score_summary: '4-4', match_players: [] }]
const before = JSON.stringify({ session, roster, rounds, matches })
let model = buildCompetitionReview(session, roster, rounds, matches, [], [])
assert.equal(model.recorded, 2); assert.equal(model.expected, 3)
const games = model.byPlayer.get('a')!
assert.deepEqual(games[0].partners, ['b']); assert.deepEqual(games[1].partners, ['c'])
assert.deepEqual(games[1].opponents, ['b', 'd'])
const summary = reviewPlayerSummary(games)
assert.equal(summary.wins, 1); assert.equal(summary.draws, 1); assert.equal(summary.losses, 0)
assert.equal(summary.scored, 10); assert.equal(summary.conceded, 7); assert.equal(summary.closest?.round, 2)
assert.equal(model.standings.format, 'singles'); assert.equal(model.standings.entries[0].total_points, 10)
assert.deepEqual(reviewRosterIdsForEntry(model.standings.entries[0], roster), ['a'])
assert.deepEqual(reviewRosterIdsForEntry({ ...model.standings.entries[0], profile_id: 'unknown', roster_entry_id: null, padel_player_id: null, member_profile_id: null, display_name: 'Player 1' }, roster), [], 'Names never decide which player review opens')
assert.deepEqual(reviewRosterIdsForEntry({ ...model.standings.entries[0], profile_id: 'member-a', roster_entry_id: null, padel_player_id: null, member_profile_id: 'member-a' }, [{ ...roster[0], profile_id: 'member-a' }]), ['a'], 'Linked account resolves to the roster identity')
assert.equal(JSON.stringify({ session, roster, rounds, matches }), before, 'Review never changes the source schedule or scores')
model = buildCompetitionReview(session, roster, rounds, [...matches, matches[0]], [], [])
assert.equal(model.recorded, 2, 'Duplicate result does not double-count')
model = buildCompetitionReview(session, roster, rounds, [...matches, { ...matches[0], score_summary: '1-2' }], [], [])
assert.equal(model.recorded, 1, 'Conflicting results remain uncounted')
for (const invalid of ['', '-1-2', '6-', 'abc', 'Infinity-2']) {
  assert.equal(buildCompetitionReview(session, roster, rounds, [{ ...matches[0], score_summary: invalid }], [], []).recorded, 0)
}
assert.equal(buildCompetitionReview(session, roster, rounds, [{ ...matches[0], score_summary: '0-0' }], [], []).byPlayer.get('a')?.[0].outcome, 'Draw')
const duo = { ...session, scoring_config: { competition_player_mode: 'duos' } } as GameSession
const pairs = [{ id: 'ab', pair_label: 'Team 1', roster_a_id: 'a', roster_b_id: 'b' }, { id: 'cd', pair_label: 'Team 2', roster_a_id: 'c', roster_b_id: 'd' }] as CompetitionSessionPair[]
model = buildCompetitionReview(duo, roster, [rounds[0]], [matches[0]], [], pairs)
assert.equal(model.standings.format, 'duos'); assert.equal(model.standings.entries.length, 2)
assert.equal(model.standings.entries[0].total_points, 6, 'Team score is not summed twice')
assert.deepEqual(reviewRosterIdsForEntry(model.standings.entries[0], roster), ['a', 'b'], 'Duo selection uses explicit team membership')
assert.ok(buildCompetitionReview(duo, roster, rounds, matches, [], []).standings.error)
assert.ok(buildCompetitionReview(duo, roster, rounds, matches, [], [pairs[0], pairs[0]]).standings.error)
assert.equal(competitionReviewAvailable(session), true)
const live = { ...session, status: 'active', competition_started_at: '2026-09-23T11:00:00Z', ends_at: '2026-09-23T13:00:00Z' } as GameSession
assert.equal(competitionReviewAvailable(live, Date.parse('2026-09-23T12:00:00Z')), false)
assert.equal(competitionReviewAvailable(live, Date.parse('2026-09-23T13:00:00Z')), true)
assert.equal(competitionReviewAvailable({ ...live, competition_started_at: null }), false)
console.log('Competition Review checks passed: singles/duos, partial results, draws, rotation history, duplicate/conflicting scores, read-only inputs and end-of-event gating.')
