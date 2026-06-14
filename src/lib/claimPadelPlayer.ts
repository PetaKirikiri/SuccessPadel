import {
  clearClaimPadelPlayer,
  consumeClaimPadelPlayer,
  peekClaimPadelPlayer,
} from './authClaimPlayer'
import { peekReturnTo } from './authReturnTo'
import { isPlayerProfilePath } from './line/profileHandshake'
import { supabase } from './supabaseClient'

/** Guest → account linking only runs from a player profile invite link. */
export function shouldClaimPendingPadelPlayer(): boolean {
  if (!peekClaimPadelPlayer()) return false
  if (isPlayerProfilePath(window.location.pathname)) return true
  const returnTo = peekReturnTo('')
  if (!returnTo) return false
  return isPlayerProfilePath(returnTo.split('?')[0])
}

export async function claimPadelPlayer(padelPlayerId: string): Promise<string | null> {
  const { error } = await supabase.rpc('claim_padel_player', {
    p_padel_player_id: padelPlayerId,
  })
  if (!error) return null

  const message = error.message ?? 'Could not link player'
  if (/already linked/i.test(message)) {
    const { data: row } = await supabase
      .from('padel_players')
      .select('profile_id')
      .eq('id', padelPlayerId)
      .maybeSingle()
    const { data: session } = await supabase.auth.getSession()
    if (row?.profile_id && session.session?.user?.id === row.profile_id) {
      return null
    }
  }

  return message
}

/** Link invite guest to the account that just signed in (player profile pages only). */
export async function claimPendingPadelPlayer(): Promise<string | null> {
  if (!shouldClaimPendingPadelPlayer()) return null
  const id = peekClaimPadelPlayer()
  if (!id) return null
  const err = await claimPadelPlayer(id)
  if (!err) consumeClaimPadelPlayer()
  return err
}

export { peekClaimPadelPlayer, clearClaimPadelPlayer }
