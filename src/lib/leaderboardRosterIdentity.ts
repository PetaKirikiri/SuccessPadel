import type { LeaderboardEntry } from './leaderboardTypes'

type MatchIdentity = {
  roster_entry_id?: string | null
  profile_id?: string | null
  padel_player_id?: string | null
}

/** Attach saved match identity evidence; never match people by display name. */
export function attachLeaderboardRosterIdentity(
  entries: LeaderboardEntry[],
  players: MatchIdentity[],
): LeaderboardEntry[] {
  return entries.map(entry => {
    if (entry.roster_entry_id) return entry
    const ids = new Set([entry.profile_id, entry.member_profile_id, entry.padel_player_id].filter(Boolean))
    const slots = new Set(players.filter(player => player.roster_entry_id &&
      [player.profile_id, player.padel_player_id].some(id => id && ids.has(id)))
      .map(player => player.roster_entry_id!))
    return slots.size === 1 ? { ...entry, roster_entry_id: [...slots][0] } : entry
  })
}
