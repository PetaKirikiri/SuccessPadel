import type { CompetitionPlayer } from '../hooks/useCompetitions'

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
export function rosterFromSlots(slots: string[], count: number): CompetitionPlayer[] {
  return Array.from({ length: count }, (_, index) => {
    const name = slots[index]?.trim()
    return previewPlayer(index, name || `Player ${index + 1}`)
  })
}

export function rosterFromNames(names: string[]): CompetitionPlayer[] {
  return names
    .map((name) => name.trim())
    .filter(Boolean)
    .map((guest_name, index) => previewPlayer(index, guest_name))
}
