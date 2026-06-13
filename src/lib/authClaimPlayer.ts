const CLAIM_PADEL_PLAYER_KEY = 'successpadel_claim_padel_player'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key)
  } catch {
    return sessionStorage.getItem(key)
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
  sessionStorage.setItem(key, value)
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem(key)
}

/** Remember which guest padel_player the user opened via invite link. */
export function saveClaimPadelPlayer(padelPlayerId: string) {
  write(CLAIM_PADEL_PLAYER_KEY, padelPlayerId)
}

export function peekClaimPadelPlayer(): string | null {
  return read(CLAIM_PADEL_PLAYER_KEY)
}

export function consumeClaimPadelPlayer(): string | null {
  const id = peekClaimPadelPlayer()
  if (id) remove(CLAIM_PADEL_PLAYER_KEY)
  return id
}

export function clearClaimPadelPlayer() {
  remove(CLAIM_PADEL_PLAYER_KEY)
}
