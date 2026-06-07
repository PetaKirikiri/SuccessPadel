import type { CompetitionPlayer } from '../hooks/useCompetitions'

export function rosterFromNames(names: string[]): CompetitionPlayer[] {
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((guest_name, index) => ({
      id: `preview-${index}`,
      profile_id: null,
      padel_player_id: null,
      guest_name,
      guest_email: null,
      rank_order: index + 1,
      profiles: null,
    }))
}
