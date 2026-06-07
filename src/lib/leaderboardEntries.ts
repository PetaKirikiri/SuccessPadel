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

export function firstDisplayName(fullName: string | null | undefined): string {
  const tokens = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return tokens[0] ?? 'Player'
}

function nameTokens(fullName: string): { first: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean)
  const first = tokens[0] ?? 'Player'
  return { first }
}

export function compactDisplayNames(names: string[]): string[] {
  return names.map((name) => nameTokens(name).first)
}

/** First name only for compact player displays. */
export function compactLeaderboardDisplayNames(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const displayNames = compactDisplayNames(entries.map((entry) => entry.display_name))
  return entries.map((entry, index) => {
    const display_name = displayNames[index] ?? entry.display_name
    return { ...entry, display_name }
  })
}

/** Fill missing avatars from RPC leaderboard rows (live standings omit photos until roster refresh). */
export function enrichStandingsWithAvatars(
  standings: LeaderboardEntry[],
  sources: LeaderboardEntry[],
): LeaderboardEntry[] {
  const byProfile = new Map<string, string>()
  const byPadel = new Map<string, string>()
  for (const row of sources) {
    if (!row.avatar_url) continue
    byProfile.set(row.profile_id, row.avatar_url)
    if (row.member_profile_id) byProfile.set(row.member_profile_id, row.avatar_url)
    if (row.padel_player_id) byPadel.set(row.padel_player_id, row.avatar_url)
  }
  return standings.map((entry) => ({
    ...entry,
    avatar_url:
      entry.avatar_url ??
      (entry.member_profile_id ? byProfile.get(entry.member_profile_id) : undefined) ??
      (entry.padel_player_id ? byPadel.get(entry.padel_player_id) : undefined) ??
      byProfile.get(entry.profile_id) ??
      null,
  }))
}
