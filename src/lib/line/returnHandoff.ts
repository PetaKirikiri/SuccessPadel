import { supabase } from '../supabaseClient'
import { rememberBrowserSession } from '../auth/cachedSession'
import { getLineIdToken, initLiff } from './liff'
import { canonicalResumeUrl } from './returnDestination'

let handoff: Promise<string> | null = null
let resume: Promise<void> | null = null

/** Once per document; LIFF init must finish before leaving its configured endpoint. */
export function prepareLineReturn(destination: string): Promise<string> {
  if (!handoff) {
    handoff = (async () => {
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      const guest = canonicalResumeUrl(destination)
      const work = async () => {
        await initLiff()
        if (controller.signal.aborted) return guest
        const token = await getLineIdToken()
        if (!token || controller.signal.aborted) return guest
        const { data, error } = await supabase.functions.invoke('line-liff-recognize', {
          body: { id_token: token, handoff: true }, signal: controller.signal,
        })
        if (controller.signal.aborted || error || data?.recognised !== true || typeof data?.ticket !== 'string') return guest
        return canonicalResumeUrl(destination, data.ticket)
      }
      try {
        return await Promise.race([
          work().catch(() => guest),
          new Promise<string>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(guest) }, 12_000) }),
        ])
      } finally { clearTimeout(timer); controller.abort() }
    })()
  }
  return handoff
}

/** Deduplicate single-use verification under React StrictMode. */
export function finishLineReturn(ticket: string | null): Promise<void> {
  if (!resume) resume = (async () => {
    try {
      sessionStorage.setItem('sp-line-passive-entry', '1')
    } catch { /* URL entry marker also prevents another handshake. */ }
    if (!ticket) return
    const { data: current } = await supabase.auth.getSession()
    if (current.session) return // Never replace an account already signed in here.
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: ticket, type: 'email' })
    if (error) throw error
    rememberBrowserSession(data.session)
  })()
  return resume
}
