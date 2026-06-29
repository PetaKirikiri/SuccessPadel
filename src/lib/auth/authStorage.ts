export const AUTH_STORAGE_KEY = 'success-padel-auth'

const memory = new Map<string, string>()

const SESSION_MIRROR_PREFIX = '__sp_session_mirror__'

let localStorageAvailable: boolean | null = null
let sessionStorageAvailable: boolean | null = null

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

function canUseSessionStorage(): boolean {
  if (sessionStorageAvailable !== null) return sessionStorageAvailable
  try {
    const probe = '__sp_auth_probe__'
    sessionStorage.setItem(probe, '1')
    sessionStorage.removeItem(probe)
    sessionStorageAvailable = true
  } catch {
    sessionStorageAvailable = false
  }
  return sessionStorageAvailable
}

function mirrorToSessionStorage(key: string, value: string): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.setItem(`${SESSION_MIRROR_PREFIX}${key}`, value)
  } catch {
    /* ignore */
  }
}

function readSessionMirror(key: string): string | null {
  if (!canUseSessionStorage()) return null
  try {
    return sessionStorage.getItem(`${SESSION_MIRROR_PREFIX}${key}`)
  } catch {
    return null
  }
}

function clearSessionMirror(key: string): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.removeItem(`${SESSION_MIRROR_PREFIX}${key}`)
  } catch {
    /* ignore */
  }
}

/** Supabase auth storage — localStorage with in-memory mirror for reliability on mobile WebViews. */
export const authStorage = {
  getItem(key: string): string | null {
    if (canUseLocalStorage()) {
      try {
        const value = localStorage.getItem(key)
        if (value !== null) {
          memory.set(key, value)
          mirrorToSessionStorage(key, value)
          return value
        }
      } catch {
        /* fall through */
      }
    }
    const mirrored = readSessionMirror(key)
    if (mirrored !== null) {
      memory.set(key, mirrored)
      return mirrored
    }
    return memory.get(key) ?? null
  },

  setItem(key: string, value: string): void {
    memory.set(key, value)
    mirrorToSessionStorage(key, value)
    if (!canUseLocalStorage()) return
    try {
      localStorage.setItem(key, value)
    } catch {
      /* keep in-memory + session mirror for this tab */
    }
  },

  removeItem(key: string): void {
    memory.delete(key)
    clearSessionMirror(key)
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
