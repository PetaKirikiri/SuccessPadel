const CLAIM_PADEL_PLAYER_KEY = 'successpadel_claim_padel_player'

export function saveClaimPadelPlayer(padelPlayerId: string) {
  sessionStorage.setItem(CLAIM_PADEL_PLAYER_KEY, padelPlayerId)
}

export function consumeClaimPadelPlayer(): string | null {
  const id = sessionStorage.getItem(CLAIM_PADEL_PLAYER_KEY)
  sessionStorage.removeItem(CLAIM_PADEL_PLAYER_KEY)
  return id
}
