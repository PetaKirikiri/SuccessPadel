import { consumeClaimPadelPlayer } from './authClaimPlayer'
import { supabase } from './supabaseClient'

export async function claimPadelPlayer(padelPlayerId: string): Promise<string | null> {
  const { error } = await supabase.rpc('claim_padel_player', {
    p_padel_player_id: padelPlayerId,
  })
  return error?.message ?? null
}

export async function claimPendingPadelPlayer(): Promise<string | null> {
  const id = consumeClaimPadelPlayer()
  if (!id) return null
  return claimPadelPlayer(id)
}
