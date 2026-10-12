import liff from '@line/liff'
import { createClient } from '@supabase/supabase-js'
import { englishEntry, ENGLISH_HOTEL } from './lib/line/englishEntry'
import { englishHandshake } from './lib/line/englishHandshake'

export async function startEnglishEntry(root: HTMLElement) {
  document.title = 'English Success'
  const heading = document.createElement('h1')
  heading.textContent = 'English Success'
  const status = document.createElement('p')
  status.setAttribute('role', 'status')
  status.textContent = 'Connecting…'
  root.replaceChildren(heading, status)
  try {
    const entry = englishEntry(window.location.search)
    if (!entry) throw new Error('Please open English Success to sign in.')
    // Never read or replace the Padel browser session. Identity comes from LINE.
    const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const destination = await englishHandshake(entry, liff, async (name, body, signal) => {
      const { data, error } = await client.functions.invoke(name, { body, signal })
      if (error || !data) throw new Error('Could not connect your account. Please try again.')
      return data
    })
    if (destination) window.location.replace(destination)
  } catch {
    status.textContent = 'Could not finish connecting. Please try again.'
    const back = document.createElement('a')
    back.href = ENGLISH_HOTEL
    back.textContent = 'Back to English Success'
    root.append(back)
  }
}
