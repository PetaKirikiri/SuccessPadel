import type { CompetitionPlayer } from '../hooks/useCompetitions'
import type { Profile } from './types'
import { resolveRosterAvatarUrl } from './resolveProfileAvatar'

export type RosterProfileOption = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
export type RosterPlayerOption = {
  id: string
  display_name: string
  profile_id: string | null
  line_picture_url?: string | null
  profiles?: RosterProfileOption | null
}

/** Public invites already carry scoped roster snapshots; no directory access is needed. */
export function inviteRosterDirectory(
  roster: CompetitionPlayer[],
  directoryProfiles: RosterProfileOption[] = [],
  directoryPlayers: RosterPlayerOption[] = [],
) {
  const profiles = new Map(directoryProfiles.map((profile) => [profile.id, profile]))
  const padelPlayers = new Map(directoryPlayers.map((player) => [player.id, player]))
  for (const slot of roster) {
    const member = slot.padel_players
    const profileId = slot.profile_id ?? member?.profile_id ?? member?.profiles?.id
    const snapshot = slot.profiles ?? member?.profiles
    // Only use stable roster identities. An unlinked guest name is not an identity match.
    const photo = resolveRosterAvatarUrl(snapshot, member?.line_picture_url)
    const name = snapshot?.display_name?.trim() || member?.display_name || slot.guest_name || 'Player'
    if (profileId) {
      const existing = profiles.get(profileId)
      profiles.set(profileId, {
        id: profileId,
        display_name: name,
        avatar_url: existing?.avatar_url?.trim() || photo,
      })
    }
    if (slot.padel_player_id) {
      const existing = padelPlayers.get(slot.padel_player_id)
      padelPlayers.set(slot.padel_player_id, {
        ...existing,
        id: slot.padel_player_id,
        display_name: name,
        profile_id: profileId ?? existing?.profile_id ?? null,
        line_picture_url: existing?.line_picture_url?.trim() || photo,
        profiles: profileId ? profiles.get(profileId) : existing?.profiles ?? null,
      })
    }
  }
  return { profiles: [...profiles.values()], padelPlayers: [...padelPlayers.values()] }
}
