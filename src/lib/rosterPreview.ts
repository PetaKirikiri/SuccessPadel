import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { clubDisplayName } from './clubMemberDisplay'

function previewPlayer(index: number, guest_name: string): CompetitionPlayer {
  return {
    id: `preview-${index}`,
    profile_id: null,
    padel_player_id: null,
    guest_name,
    guest_email: null,
    rank_order: index + 1,
    profiles: null,
  }
}

/** Full roster for layout preview — empty slots show as Player 1, Player 2, … */
export function rosterFromSlots(
  slots: string[],
  count: number,
  profileIds?: (string | null)[],
  profileAvatars?: (string | null)[],
): CompetitionPlayer[] {
  return Array.from({ length: count }, (_, index) => {
    const name = slots[index]?.trim() || `Player ${index + 1}`
    const profileId = profileIds?.[index] ?? null
    const avatarUrl = profileAvatars?.[index] ?? null
    if (profileId) {
      return {
        id: `preview-${index}`,
        profile_id: profileId,
        padel_player_id: null,
        guest_name: clubDisplayName(profileId, name),
        guest_email: null,
        rank_order: index + 1,
        profiles: {
          id: profileId,
          display_name: clubDisplayName(profileId, name),
          avatar_url: avatarUrl,
        },
      }
    }
    return previewPlayer(index, name)
  })
}

export function rosterFromNames(names: string[]): CompetitionPlayer[] {
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((guest_name, index) => previewPlayer(index, guest_name))
}
