import assert from 'node:assert/strict'
import { resolveRosterPlayer } from '../src/lib/competitionRosterAvatars.ts'
import { rosterDisplayName, type CompetitionPlayer } from '../src/hooks/useCompetitions.ts'

for (const [rosterName, accountName] of [["P'Thida", 'Thida'], ['Arzina', 'Arzina Zaza'], ['Mamasung', 'Jansuda K.']]) {
  const player: CompetitionPlayer = {
    id: 'slot', profile_id: 'profile', padel_player_id: 'member', guest_name: null,
    guest_email: null, rank_order: 0,
    profiles: { id: 'profile', display_name: rosterName, avatar_url: null },
  }
  const signedOut = resolveRosterPlayer(player, new Map(), new Map())
  const signedIn = resolveRosterPlayer(player,
    new Map([['profile', { id: 'profile', display_name: accountName, avatar_url: 'https://example.com/avatar.jpg' }]]),
    new Map([['member', { id: 'member', profile_id: 'profile', display_name: rosterName }]]))
  assert.equal(rosterDisplayName(signedOut), rosterName)
  assert.equal(rosterDisplayName(signedIn), rosterName)
  assert.equal(signedIn.profiles?.avatar_url, 'https://example.com/avatar.jpg')
}
console.log('Roster names stay identical with and without profile access; photos still enrich')
