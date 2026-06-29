import type { User } from '@supabase/supabase-js'
import { readCachedProfile } from './cachedProfile'
import { readStoredAuthUserId } from './cachedSession'

/** Minimal user stub so UI stays signed-in while Supabase session restores. */
export function stubAuthUser(userId: string): User {
  return {
    id: userId,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '',
  } as User
}

export function readBootAuthUser(): User | null {
  const id = readStoredAuthUserId()
  return id ? stubAuthUser(id) : null
}

export function readBootProfile() {
  return readCachedProfile()
}
