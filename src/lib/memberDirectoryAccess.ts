export const OWNER_ACCESS_KEY = 'success-padel:member-directory-owner'
type AccessStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

// This is only a remembered capability, never an authorization decision.
// The server revalidates it on entry and on every read/write RPC.
export function directoryOwnerToken(hash: string, storage: AccessStorage): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (params.has('owner')) return params.get('owner') || null
  try { return storage.getItem(OWNER_ACCESS_KEY) } catch { return null }
}

export function rememberDirectoryOwner(token: string | null, storage: AccessStorage): void {
  try {
    if (token) storage.setItem(OWNER_ACCESS_KEY, token)
    else storage.removeItem(OWNER_ACCESS_KEY)
  } catch { /* Private browsing may disable storage; the owner URL still works. */ }
}
