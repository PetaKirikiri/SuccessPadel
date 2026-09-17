import assert from 'node:assert/strict'
import { playerDisplayName } from '../src/lib/playerDisplayName'
import { clubDisplayName, clubDisplayNameFromLine, PETER_P_PROFILE_ID } from '../src/lib/clubMemberDisplay'
import { compactDisplayNames, firstDisplayName } from '../src/lib/leaderboardEntries'
import { rosterDisplayName, type CompetitionPlayer } from '../src/hooks/useCompetitions'

for (const [raw, expected] of [
  ['🌸 Tidtee 🎾', 'Tidtee'], ['✨Tidtee✨', 'Tidtee'],
  ['🇹🇭 ทิดตี้ 🏸', 'ทิดตี้'], ['👩🏽‍👩🏻‍👧🏿‍👦🏼 Nee', 'Nee'],
  ['1️⃣ Dave 2', 'Dave 2'], ['❤️ P’Nee', 'P’Nee'],
  ['Jean-Luc Élodie', 'Jean-Luc Élodie'], ['David M', 'David M'],
  ['🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F} Tak', 'Tak'],
  ['🎾✨', 'Player'], ['', 'Player'],
]) assert.equal(playerDisplayName(raw), expected)
assert.equal(firstDisplayName('🎾 Tidtee 🌸'), 'Tidtee')
assert.deepEqual(compactDisplayNames(['🎾 Tidtee', 'David M 👏']), ['Tidtee', 'David M'])
assert.equal(clubDisplayName(PETER_P_PROFILE_ID, 'Peter 🎾'), 'Peter P')
assert.equal(clubDisplayName(null, '🌸 Tidtee'), 'Tidtee')
assert.equal(clubDisplayNameFromLine(null, '🌸 Tidtee'), '🌸 Tidtee', 'LINE ingestion stays unchanged')
const roster = { id: 'slot-1', profile_id: null, padel_player_id: null,
  guest_name: '🌸 Tidtee', guest_email: null, rank_order: 1, profiles: null } satisfies CompetitionPlayer
assert.equal(rosterDisplayName(roster), 'Tidtee')
assert.equal(roster.guest_name, '🌸 Tidtee', 'Stored source stays unchanged')
console.log('Player display names: emoji removal, Unicode preservation, roster and original LINE data passed')
