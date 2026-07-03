import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { GameSession, Profile } from '../lib/types'
import { clubDisplayName } from '../lib/clubMemberDisplay'
import type { LeaderboardEntry } from '../lib/leaderboardTypes'
import { leaderboardEntryLookupIds } from '../lib/leaderboardEntries'
import type { CourtPlayer } from '../lib/americanoSchedule'
import { parsePlayerGender, type PlayerGender } from '../lib/profileFields'
import { isOpenSlotId, sortRosterByRank } from '../lib/rankedSchedule'

type CompetitionProfileSnapshot = Pick<Profile, 'id' | 'display_name' | 'avatar_url'> &
  Partial<Pick<Profile, 'avatar_mode' | 'pixel_avatar' | 'gender'>>

export type CompetitionPlayer = {
  id: string
  profile_id: string | null
  padel_player_id: string | null
  guest_name: string | null
  guest_email: string | null
  rank_order: number | null
  profiles: CompetitionProfileSnapshot | null
  padel_players?: (Pick<Profile, 'id' | 'display_name'> & {
    profile_id?: string | null
    line_picture_url?: string | null
    profiles?: CompetitionProfileSnapshot | null
  }) | null
}

export function rosterEntryGender(sp: CompetitionPlayer | undefined): PlayerGender | null {
  if (!sp) return null
  return (
    parsePlayerGender(sp.profiles?.gender) ??
    parsePlayerGender(sp.padel_players?.profiles?.gender)
  )
}

export function rosterDisplayName(sp: CompetitionPlayer): string {
  const profileId =
    sp.profile_id ?? sp.profiles?.id ?? sp.padel_players?.profile_id ?? sp.padel_players?.profiles?.id ?? null
  const fromProfile =
    sp.profiles?.display_name?.trim() || sp.padel_players?.profiles?.display_name?.trim()
  if (fromProfile) {
    return clubDisplayName(profileId, fromProfile)
  }
  const fromPadel = sp.padel_players?.display_name?.trim()
  if (fromPadel) return fromPadel
  const guest = sp.guest_name?.trim()
  if (guest) return guest
  return 'Player'
}

/** Merge RPC leaderboard names onto session_players roster rows (court cards use this). */
export function buildRosterNameById(
  roster: CompetitionPlayer[],
  leaderboard: LeaderboardEntry[] = [],
): Map<string, string> {
  const byProfile = new Map<string, string>()
  const byPadel = new Map<string, string>()
  for (const entry of leaderboard) {
    const name = entry.display_name?.trim()
    if (!name) continue
    byProfile.set(entry.profile_id, name)
    if (entry.member_profile_id) byProfile.set(entry.member_profile_id, name)
    if (entry.padel_player_id) byPadel.set(entry.padel_player_id, name)
  }
  const out = new Map<string, string>()
  for (const row of roster) {
    const profileId =
      row.profile_id ?? row.profiles?.id ?? row.padel_players?.profile_id ?? null
    const padelId = row.padel_player_id ?? row.padel_players?.id ?? null
    const fromLeaderboard =
      (profileId ? byProfile.get(profileId) : undefined) ??
      (padelId ? byPadel.get(padelId) : undefined)
    const name = fromLeaderboard
      ? clubDisplayName(profileId, fromLeaderboard)
      : rosterDisplayName(row)
    out.set(row.id, name)
    if (name !== 'Player') {
      if (profileId) out.set(profileId, name)
      if (padelId) out.set(padelId, name)
    }
  }
  return out
}

function pickDisplayName(...candidates: (string | null | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (trimmed && trimmed !== 'Player') return trimmed
  }
  return undefined
}

/** Stale schedule rows often keep old session_players ids while signups use new ids. */
function zipUnnamedScheduleIdToNamed(
  rosterId: string,
  roster: CompetitionPlayer[],
  rosterNameById: Map<string, string>,
): string | undefined {
  const isNamed = (id: string) => {
    const name = rosterNameById.get(id)?.trim()
    return Boolean(name && name !== 'Player')
  }
  const sortable = sortRosterByRank(roster).filter((row) => !isOpenSlotId(row.id))
  const unnamed = sortable.filter((row) => !isNamed(row.id))
  const named = sortable.filter((row) => isNamed(row.id))
  const idx = unnamed.findIndex((row) => row.id === rosterId)
  if (idx < 0 || idx >= named.length) return undefined
  return rosterNameById.get(named[idx]!.id)
}

/** Same sources as the leaderboard panel — used at court-card render time. */
export function resolveCourtPlayerDisplayName(
  player: CourtPlayer | undefined,
  fallback: string,
  roster: CompetitionPlayer[],
  rosterNameById: Map<string, string>,
  standings: LeaderboardEntry[] = [],
): string {
  const rosterId = player?.rosterId ?? ''
  const row = rosterId ? roster.find((r) => r.id === rosterId) : undefined
  const profileId = row?.profile_id ?? row?.profiles?.id ?? player?.id ?? null
  const padelId = row?.padel_player_id ?? row?.padel_players?.id ?? null

  let name = pickDisplayName(
    rosterId ? rosterNameById.get(rosterId) : undefined,
    profileId ? rosterNameById.get(profileId) : undefined,
    padelId ? rosterNameById.get(padelId) : undefined,
    player?.name,
    fallback,
  )
  if (name) return name

  for (const entry of standings) {
    const display = entry.display_name?.trim()
    if (!display || display === 'Player') continue
    const ids = leaderboardEntryLookupIds(entry)
    if (
      (rosterId && ids.includes(rosterId)) ||
      (profileId && ids.includes(profileId)) ||
      (padelId && ids.includes(padelId))
    ) {
      return display
    }
  }

  if (row && (profileId || padelId)) {
    for (const other of roster) {
      if (other.id === row.id) continue
      const otherProfile = other.profile_id ?? other.profiles?.id
      const otherPadel = other.padel_player_id ?? other.padel_players?.id
      if (
        (profileId && otherProfile === profileId) ||
        (padelId && otherPadel === padelId)
      ) {
        name = pickDisplayName(rosterNameById.get(other.id))
        if (name) return name
      }
    }
  }

  if (rosterId) {
    const zipped = zipUnnamedScheduleIdToNamed(rosterId, roster, rosterNameById)
    if (zipped) return zipped
  }

  return pickDisplayName(player?.name, fallback) ?? 'Player'
}

export type CompetitionRow = GameSession & {
  session_players: CompetitionPlayer[]
  session_pairs?: CompetitionSessionPair[]
}

export type CompetitionSessionPair = {
  id: string
  pair_label: string | null
  roster_a_id: string | null
  roster_b_id: string | null
}

export function useCompetitions(_userId?: string) {
  const location = useLocation()
  const [rows, setRows] = useState<CompetitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('game_sessions')
      .select(
        `*,
         session_players(id, profile_id, padel_player_id, guest_name, guest_email, rank_order, profiles(id, display_name, avatar_url, avatar_mode, pixel_avatar, gender), padel_players(id, display_name, profile_id, line_picture_url, profiles(id, display_name, avatar_url, avatar_mode, pixel_avatar, gender))),
         session_pairs(id, pair_label, roster_a_id, roster_b_id)`,
      )
      .eq('game_kind', 'competition')
      .in('status', ['open', 'locked', 'complete'])
      .order('starts_at', { ascending: true })
      .order('starts_on', { ascending: true })

    if (queryError) {
      console.error('useCompetitions', queryError.message)
      setError(queryError.message)
      setRows([])
    } else {
      setRows((data as CompetitionRow[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, location.key])

  useEffect(() => {
    const onProfileSynced = () => {
      void refresh()
    }
    window.addEventListener('successpadel:profile-synced', onProfileSynced)
    return () => window.removeEventListener('successpadel:profile-synced', onProfileSynced)
  }, [refresh])

  return { rows, loading, error, refresh }
}
