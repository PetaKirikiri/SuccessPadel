import type { NavigateFunction } from 'react-router-dom'
import type { LeaderboardEntry } from '../lib/leaderboardTypes'
import type { Achievement } from './competitionAchievements'
import { isPlayerUuid, playerProfilePath } from './playerProfileSlug'
import { supabase } from './supabaseClient'

export type PlayerProfileSnapshot = {
  entry: LeaderboardEntry
  rank: number
  unit: string
  badges: Achievement[]
}

export type OpenPlayerProfileInput = {
  profileId?: string | null
  padelPlayerId?: string | null
  displayName?: string | null
  competitionId?: string | null
  from?: string
  snapshot?: PlayerProfileSnapshot
}

export async function resolvePlayerRouteId(
  input: Pick<OpenPlayerProfileInput, 'profileId' | 'padelPlayerId' | 'displayName'>,
): Promise<string | null> {
  if (isPlayerUuid(input.padelPlayerId)) return input.padelPlayerId
  if (isPlayerUuid(input.profileId)) return input.profileId
  const name = input.displayName?.trim()
  if (!name) return null

  // Opening a profile must never create a second player from a display label.
  // A name-only legacy caller may navigate only to an unambiguous existing row.
  const { data, error } = await supabase.from('padel_players')
    .select('id, display_name').ilike('display_name', name)
  if (error) return null
  const matches = (data ?? []).filter(row => row.display_name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())
  return matches.length === 1 ? matches[0]!.id : null
}

export async function openPlayerProfile(
  navigate: NavigateFunction,
  input: OpenPlayerProfileInput,
): Promise<boolean> {
  const playerId = await resolvePlayerRouteId(input)
  if (!playerId) return false

  navigate(
    playerProfilePath({
      id: playerId,
      displayName: input.displayName,
      competitionId: input.competitionId,
    }),
    {
      state: {
        from: input.from,
        snapshot: input.snapshot,
      },
    },
  )
  return true
}
