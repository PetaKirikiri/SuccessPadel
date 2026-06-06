import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Profile } from './types'

export async function syncProfileForUser(user: User): Promise<Profile | null> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.rpc('link_guest_rosters_by_email')
    return existing as Profile
  }

  const { data: ensured, error } = await supabase.rpc('ensure_profile')
  if (error) {
    console.error('ensure_profile failed', error.message)
    return null
  }

  const profile = (ensured as Profile) ?? null
  if (profile) await supabase.rpc('link_guest_rosters_by_email')
  return profile
}

export async function linkGuestRostersByEmail(): Promise<void> {
  await supabase.rpc('link_guest_rosters_by_email')
}
