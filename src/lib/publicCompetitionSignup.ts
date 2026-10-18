import type { CompetitionRow } from '../hooks/useCompetitions'
import { competitionRosterSlots } from './competitionGameDisplay'
import { supabase } from './supabaseClient'

export function publicSignupChanges(row: CompetitionRow, names: string[], memberIds?: (string | null)[]) {
  const original = competitionRosterSlots(row)
  return names.flatMap((name, slot) => {
    const player = row.session_players?.find(p => p.rank_order === slot)
    const memberId = memberIds ? memberIds[slot] ?? null : player?.profile_id ?? player?.padel_player_id ?? null
    if (name.trim() === (original[slot]?.name ?? '').trim() && memberId === (player?.profile_id ?? player?.padel_player_id ?? null)) return []
    return [{ slot, name: name.trim(), member_id: name.trim() ? memberId : null, expected_id: player?.id ?? null,
      expected_profile_id: player?.profile_id ?? null,
      expected_padel_player_id: player?.padel_player_id ?? null,
      expected_guest_name: player?.guest_name ?? null }]
  })
}

export async function savePublicCompetitionSignup(row: CompetitionRow, names: string[], memberIds?: (string | null)[]): Promise<string | null> {
  const changes = publicSignupChanges(row, names, memberIds)
  if (!changes.length) return null
  const { data, error } = await supabase.functions.invoke('competition-signup', { body: { sessionId: row.id, changes } })
  if (error) {
    try { return (await error.context.json()).error ?? error.message } catch { return error.message }
  }
  return data?.error ?? null
}
