import assert from 'node:assert/strict'
import { inviteRosterDirectory } from '../src/lib/inviteRosterDirectory.ts'
import type { CompetitionPlayer } from '../src/hooks/useCompetitions.ts'
const slot = (patch: Partial<CompetitionPlayer>): CompetitionPlayer => ({
  id: 'slot', profile_id: null, padel_player_id: null, profiles: null,
  guest_name: 'Player', guest_email: null, rank_order: 0, ...patch,
})
const direct = slot({ profile_id: 'p1', profiles: { id: 'p1', display_name: 'Roster name', avatar_url: 'saved.jpg' } })
const registry = slot({ padel_player_id: 'r1', padel_players: { id: 'r1', display_name: 'Registry name', line_picture_url: 'line.jpg' } })
const nested = slot({ padel_player_id: 'r2', padel_players: { id: 'r2', display_name: 'Nested', profile_id: 'p2', profiles: { id: 'p2', display_name: 'Nested', avatar_url: 'nested.jpg' } } })
const anonymous = inviteRosterDirectory([direct, registry, nested])
assert.equal(anonymous.profiles.find(p => p.id === 'p1')?.avatar_url, 'saved.jpg')
assert.equal(anonymous.padelPlayers.find(p => p.id === 'r1')?.line_picture_url, 'line.jpg')
assert.equal(anonymous.padelPlayers.find(p => p.id === 'r2')?.profiles?.avatar_url, 'nested.jpg')
const refreshed = inviteRosterDirectory([direct], [{ id: 'p1', display_name: 'Account name', avatar_url: 'new.jpg' }])
assert.equal(refreshed.profiles[0].display_name, 'Roster name')
assert.equal(refreshed.profiles[0].avatar_url, 'new.jpg')
assert.equal(inviteRosterDirectory([direct], [{ id: 'p1', display_name: 'Account name', avatar_url: null }]).profiles[0].avatar_url, 'saved.jpg')
const guest = slot({ guest_name: 'Roster name' })
assert.deepEqual(inviteRosterDirectory([guest]), { profiles: [], padelPlayers: [] })
assert.equal(guest.profile_id, null)
assert.equal(direct.profiles?.avatar_url, 'saved.jpg')
assert.deepEqual(inviteRosterDirectory([]), { profiles: [], padelPlayers: [] })
console.log('PASS: invite snapshots preserve linked photos without directory access, retain roster names, refresh photos, and do not infer guest identities')
