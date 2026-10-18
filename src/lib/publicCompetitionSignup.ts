import type { CompetitionRow } from '../hooks/useCompetitions'
import { competitionRosterSlots } from './competitionGameDisplay'
import { supabase } from './supabaseClient'

export function publicSignupChanges(row: CompetitionRow, names: string[]) {
  const original = competitionRosterSlots(row)
  return names.flatMap((name, slot) => {
    if (name.trim() === (original[slot]?.name ?? '').trim()) return []
    const player = row.session_players?.find(p => p.rank_order === slot)
    return [{ slot, name: name.trim(), expected_id: player?.id ?? null,
      expected_profile_id: player?.profile_id ?? null,
      expected_padel_player_id: player?.padel_player_id ?? null,
      expected_guest_name: player?.guest_name ?? null }]
  })
}

export async function savePublicCompetitionSignup(row: CompetitionRow, names: string[]): Promise<string | null> {
  const changes = publicSignupChanges(row, names)
  if (!changes.length) return null
  const { data, error } = await supabase.functions.invoke('competition-signup', { body: { sessionId: row.id, changes } })
  if (error) {
    try { return (await error.context.json()).error ?? error.message } catch { return error.message }
  }
  return data?.error ?? null
}
