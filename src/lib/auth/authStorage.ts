export const AUTH_STORAGE_KEY = 'success-padel-auth'

const memory = new Map<string, string>()

let localStorageAvailable: boolean | null = null

function canUseLocalStorage(): boolean {
  if (localStorageAvailable !== null) return localStorageAvailable
  try {
    const probe = '__sp_auth_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    localStorageAvailable = true
  } catch {
    localStorageAvailable = false
  }
  return localStorageAvailable
}

/** Supabase auth storage — localStorage with in-memory mirror for reliability on mobile WebViews. */
export const authStorage = {
  getItem(key: string): string | null {
    if (canUseLocalStorage()) {
      try {
        const value = localStorage.getItem(key)
        if (value !== null) memory.set(key, value)
        return value
      } catch {
        /* fall through */
      }
    }
    return memory.get(key) ?? null
  },

  setItem(key: string, value: string): void {
    memory.set(key, value)
    if (!canUseLocalStorage()) return
    try {
      localStorage.setItem(key, value)
    } catch {
      /* keep in-memory copy for this tab */
    }
  },

  removeItem(key: string): void {
    memory.delete(key)
    if (!canUseLocalStorage()) return
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

export function hasPersistedAuthRecord(): boolean {
  return Boolean(authStorage.getItem(AUTH_STORAGE_KEY))
}
