import type { NavigateFunction } from 'react-router-dom'
import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
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
  if (isPlayerUuid(input.profileId)) return input.profileId
  if (isPlayerUuid(input.padelPlayerId)) return input.padelPlayerId
  const name = input.displayName?.trim()
  if (!name) return null

  const { data, error } = await supabase.rpc('find_or_create_padel_player', {
    p_display_name: name,
    p_guest_email: null,
    p_profile_id: null,
  })
  if (error || !data) return null
  return data as string
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
