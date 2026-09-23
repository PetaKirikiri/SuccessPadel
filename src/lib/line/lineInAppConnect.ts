import { supabase } from '../supabaseClient'
import { rememberBrowserSession } from '../auth/cachedSession'
import { getLineIdToken, hasLiffId, initLiff, isInLineClient, isLineLoggedIn } from './liff'
import { isLineEntryBrowser, recogniseLineAccount, type RecognitionResult } from './passiveRecognition'

let recognition: Promise<RecognitionResult> | null = null

export function shouldTryLineInAppSignIn(isAuthenticated: boolean): boolean {
  return !isAuthenticated && hasLiffId() && isLineEntryBrowser(navigator.userAgent, isInLineClient())
}

/** Once per document, including StrictMode, route changes and visibility resumes. */
export function runLineInAppSignIn(mayContinue: () => boolean): Promise<RecognitionResult> {
  if (!recognition) {
    recognition = recogniseLineAccount({
      init: initLiff,
      token: async () => isLineLoggedIn() ? getLineIdToken() : null,
      exchange: async (idToken, signal) => {
        // Separate endpoint: an older deployed signup handler can never create
        // an account by ignoring an "existing only" request option.
        const { data, error } = await supabase.functions.invoke('line-liff-recognize', {
          body: { id_token: idToken },
          signal,
        })
        if (error || data?.recognised !== true) return null
        if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') return null
        return { access_token: data.access_token, refresh_token: data.refresh_token }
      },
      apply: async (tokens, signal) => {
        const { data: current } = await supabase.auth.getSession()
        if (current.session || signal.aborted || !mayContinue()) return
        const { data, error } = await supabase.auth.setSession(tokens)
        if (error) throw error
        rememberBrowserSession(data.session)
        // AuthProvider owns profile loading/permissions via onAuthStateChange.
      },
      mayContinue,
    })
  }
  return recognition
}
