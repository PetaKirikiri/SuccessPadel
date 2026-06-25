import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import { isDuoLeaderboardEntry } from './leaderboardFilters'

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
  if (e.member_profile_id) return false
  return Boolean(e.is_guest && e.padel_player_id)
}

/** All ids used to attach or resolve achievement badges for a leaderboard row. */
export function leaderboardEntryLookupIds(
  entry: Pick<
    LeaderboardEntry,
    'profile_id' | 'member_profile_id' | 'padel_player_id' | 'display_name'
  >,
): string[] {
  const ids: string[] = []
  const push = (id: string | null | undefined) => {
    if (id && !ids.includes(id)) ids.push(id)
  }
  push(entry.padel_player_id)
  push(entry.member_profile_id)
  push(entry.profile_id)
  push(entry.display_name)
  return ids
}

function isNumberedPlayerLabel(name: string): boolean {
  return /^Player\s+\S+$/i.test(name.trim())
}

export function firstDisplayName(fullName: string | null | undefined): string {
  const trimmed = (fullName ?? '').trim()
  if (isNumberedPlayerLabel(trimmed)) return trimmed
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  return tokens[0] ?? 'Player'
}

function nameTokens(fullName: string): { first: string } {
  const trimmed = fullName.trim()
  if (isNumberedPlayerLabel(trimmed)) return { first: trimmed }
  const tokens = trimmed.split(/\s+/).filter(Boolean)
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
    const display_name = isDuoLeaderboardEntry(entry.profile_id)
      ? entry.display_name
      : (displayNames[index] ?? entry.display_name)
    return { ...entry, display_name }
  })
}

function leaderboardSourceMaps(sources: LeaderboardEntry[]) {
  const byProfile = new Map<string, LeaderboardEntry>()
  const byPadel = new Map<string, LeaderboardEntry>()
  for (const row of sources) {
    byProfile.set(row.profile_id, row)
    if (row.member_profile_id) byProfile.set(row.member_profile_id, row)
    if (row.padel_player_id) byPadel.set(row.padel_player_id, row)
  }
  return { byProfile, byPadel }
}

function matchLeaderboardSource(
  entry: LeaderboardEntry,
  byProfile: Map<string, LeaderboardEntry>,
  byPadel: Map<string, LeaderboardEntry>,
): LeaderboardEntry | undefined {
  return (
    (entry.member_profile_id ? byProfile.get(entry.member_profile_id) : undefined) ??
    (entry.padel_player_id ? byPadel.get(entry.padel_player_id) : undefined) ??
    byProfile.get(entry.profile_id)
  )
}

/** Merge LINE name, photo, and link state from RPC leaderboard into live standings. */
export function enrichStandingsWithAvatars(
  standings: LeaderboardEntry[],
  sources: LeaderboardEntry[],
): LeaderboardEntry[] {
  const { byProfile, byPadel } = leaderboardSourceMaps(sources)
  return standings.map((entry) => {
    const source = matchLeaderboardSource(entry, byProfile, byPadel)
    const linked = Boolean(source?.member_profile_id ?? entry.member_profile_id)
    return {
      ...entry,
      member_profile_id: entry.member_profile_id ?? source?.member_profile_id ?? null,
      is_guest: linked ? false : (source?.is_guest ?? entry.is_guest),
      display_name: source?.display_name ?? entry.display_name,
      avatar_url:
        entry.avatar_url ??
        source?.avatar_url ??
        (entry.member_profile_id ? byProfile.get(entry.member_profile_id)?.avatar_url : undefined) ??
        (entry.padel_player_id ? byPadel.get(entry.padel_player_id)?.avatar_url : undefined) ??
        byProfile.get(entry.profile_id)?.avatar_url ??
        null,
    }
  })
}
