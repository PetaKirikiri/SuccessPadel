import { createClient } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, authStorage } from './auth/authStorage'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
    storageKey: AUTH_STORAGE_KEY,
  },
})

export const supabaseProjectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null
