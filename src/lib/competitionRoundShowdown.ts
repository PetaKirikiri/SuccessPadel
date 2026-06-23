import type { CompetitionPlayer } from '../hooks/useCompetitions'
import type { CompetitionRound } from '../hooks/useCompetitionRun'
import type { PixelAvatarConfig } from './pixelAvatar/types'

type ProfileSnapshot = {
  id: string
  display_name: string
  avatar_url?: string | null
  pixel_avatar?: PixelAvatarConfig | null
}

function profileFieldsFromRoster(sp: CompetitionPlayer, existing?: ProfileSnapshot | null) {
  if (!sp.profiles) return null
  return {
    id: sp.profiles.id,
    display_name: sp.profiles.display_name,
    avatar_url: sp.profiles.avatar_url ?? null,
    pixel_avatar: sp.profiles.pixel_avatar ?? existing?.pixel_avatar ?? null,
  }
}

/** Copy showdown fields from enriched roster onto live round player rows. */
export function mergeShowdownIntoRounds(
  rounds: CompetitionRound[],
  roster: CompetitionPlayer[],
): CompetitionRound[] {
  const byRosterId = new Map(roster.map((sp) => [sp.id, sp]))
  const byProfileId = new Map(
    roster
      .map((sp) => {
        const profileId = sp.profile_id ?? sp.profiles?.id ?? null
        return profileId ? ([profileId, sp] as const) : null
      })
      .filter((entry): entry is [string, CompetitionPlayer] => entry !== null),
  )

  return rounds.map((round) => ({
    ...round,
    competition_round_players: (round.competition_round_players ?? []).map((player) => {
      const existingProfile = player.session_players?.profiles
      const rosterRow =
        (player.roster_entry_id ? byRosterId.get(player.roster_entry_id) : undefined) ??
        (player.profile_id ? byProfileId.get(player.profile_id) : undefined) ??
        (existingProfile?.id ? byProfileId.get(existingProfile.id) : undefined)
      const mergedProfile = rosterRow
        ? profileFieldsFromRoster(rosterRow, existingProfile)
        : existingProfile?.pixel_avatar
          ? {
              id: existingProfile.id,
              display_name: existingProfile.display_name,
              avatar_url: existingProfile.avatar_url ?? null,
              pixel_avatar: existingProfile.pixel_avatar,
            }
          : null
      if (!mergedProfile || !player.session_players) return player
      return {
        ...player,
        session_players: {
          ...player.session_players,
          profiles: mergedProfile,
        },
      }
    }),
  }))
}
