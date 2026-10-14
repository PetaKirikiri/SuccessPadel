import liff from '@line/liff'
import { createClient } from '@supabase/supabase-js'
import { englishEntry, englishDestination } from './lib/line/englishEntry'
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
    }, 20000, step => { root.dataset.lineStep = step })
    if (destination) window.location.replace(destination)
  } catch (error) {
    // Fixed stage and short SDK code only: never log identity/session tokens or
    // raw provider responses. Helps distinguish LINE/network vs account errors.
    const rawCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : error instanceof Error ? error.name : 'UNKNOWN'
    const code = /^[A-Za-z0-9_-]{1,40}$/.test(rawCode) ? rawCode : 'UNKNOWN'
    console.warn('EnglishSuccess connection failed', root.dataset.lineStep ?? 'setup', code)
    status.textContent = root.dataset.lineStep === 'line-initialization'
      ? 'Could not connect to LINE. Please try again in LINE.'
      : 'Could not finish connecting. Please try again.'
    const back = document.createElement('a')
    back.href = englishDestination(englishEntry(window.location.search)?.mode)
    back.textContent = 'Back to English Success'
    root.append(back)
  }
}
