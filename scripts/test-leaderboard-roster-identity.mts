import assert from 'node:assert/strict'
import fs from 'node:fs'
import { attachLeaderboardRosterIdentity } from '../src/lib/leaderboardRosterIdentity'
import { completeCompetitionLeaderboard } from '../src/lib/competitionStandings'

const entry = { profile_id: 'player-a', display_name: 'Same name', total_points: 11, games: 2 }
assert.equal(attachLeaderboardRosterIdentity([entry], [{ profile_id: 'other', roster_entry_id: 'slot' }])[0], entry)
assert.equal(attachLeaderboardRosterIdentity([entry], [
  { padel_player_id: 'player-a', roster_entry_id: 'slot' },
  { padel_player_id: 'player-a', roster_entry_id: 'slot' },
])[0].roster_entry_id, 'slot')
assert.equal(attachLeaderboardRosterIdentity([entry], [
  { padel_player_id: 'player-a', roster_entry_id: 'slot' },
  { padel_player_id: 'player-a', roster_entry_id: 'other-slot' },
])[0], entry)
const file = process.env.LEADERBOARD_BACKUP
if (file) {
  const { snapshot } = JSON.parse(fs.readFileSync(file, 'utf8'))
  const before = completeCompetitionLeaderboard(snapshot.roster, snapshot.leaderboard)
  const linked = attachLeaderboardRosterIdentity(snapshot.leaderboard, snapshot.match_players)
  const after = completeCompetitionLeaderboard(snapshot.roster, linked)
  assert.equal(before.length, 29)
  assert.equal(after.length, 16)
  for (const saved of snapshot.leaderboard) {
    const result = after.find(row => row.profile_id === saved.profile_id)!
    for (const field of ['total_points', 'games', 'wins', 'losses', 'draws']) {
      assert.equal(result[field], saved[field])
    }
  }
  console.log('Tonight backup: 29 -> 16 rows; every saved score and result unchanged')
}
console.log('Identity matching and ambiguity checks passed')
