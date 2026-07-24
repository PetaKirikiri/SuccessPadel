import { supabase } from './supabaseClient'

export type AutoRankRosterPlayer = {
  slotIndex: number
  profileId: string | null
  padelPlayerId: string | null
}

export type AutoRankResult = {
  slot_index: number
  ranking_points: number
  competitions: number
}

export async function fetchCompetitionAutoRank(
  players: AutoRankRosterPlayer[],
  gender: 'Men' | 'Women' | 'Mixed',
): Promise<{ rows: AutoRankResult[]; error: string | null }> {
  const { data, error } = await supabase.rpc('auto_rank_competition_roster', {
    p_players: players.map((player) => ({
      slot_index: player.slotIndex,
      profile_id: player.profileId,
      padel_player_id: player.padelPlayerId,
    })),
    p_gender: gender,
  })
  return {
    rows: (data as AutoRankResult[] | null) ?? [],
    error: error?.message ?? null,
  }
}
