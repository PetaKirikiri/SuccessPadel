import type { Profile } from '../types'

const PROFILE_CACHE_KEY = 'success-padel-profile-cache'
const PROFILE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365

type CachedProfileRecord = {
  savedAt: number
  userId: string
  profile: Profile
}

function readRecord(): CachedProfileRecord | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedProfileRecord>
    if (
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.userId !== 'string' ||
      !parsed.profile ||
      typeof parsed.profile.id !== 'string'
    ) {
      return null
    }
    if (Date.now() - parsed.savedAt > PROFILE_MAX_AGE_MS) {
      localStorage.removeItem(PROFILE_CACHE_KEY)
      return null
    }
    return parsed as CachedProfileRecord
  } catch {
    return null
  }
}

export function rememberCachedProfile(profile: Profile): void {
  try {
    const record: CachedProfileRecord = {
      savedAt: Date.now(),
      userId: profile.id,
      profile,
    }
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(record))
  } catch {
    /* private mode / quota */
  }
}

export function readCachedProfile(userId?: string): Profile | null {
  const record = readRecord()
  if (!record) return null
  if (userId && record.userId !== userId) return null
  return record.profile
}

export function clearCachedProfile(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    /* ignore */
  }
}
