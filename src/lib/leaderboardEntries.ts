import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'

/** Ensure guest rows have claim ids even when RPC fields are partial. */
export function normalizeLeaderboardEntries(rows: LeaderboardEntry[]): LeaderboardEntry[] {
  return rows.map((e) => {
    if (e.is_guest != null) {
      return {
        ...e,
        padel_player_id: e.padel_player_id ?? (e.is_guest ? e.profile_id : null),
      }
    }
    if (e.padel_player_id) {
      return { ...e, is_guest: true }
    }
    return e
  })
}

export function isClaimableGuest(e: LeaderboardEntry): boolean {
  return Boolean(e.is_guest && e.padel_player_id)
}
