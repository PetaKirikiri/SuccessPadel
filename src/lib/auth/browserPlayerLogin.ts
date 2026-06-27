import { supabase } from '../supabaseClient'

function normalizeUsername(username: string): string {
  return username.trim().replace(/\s+/g, ' ')
}

export async function signInWithBrowserPlayerUsername(usernameInput: string): Promise<string | null> {
  const username = normalizeUsername(usernameInput)
  if (!username) return 'Enter your username.'

  const password = username

  const { data, error } = await supabase.functions.invoke('browser-player-login', {
    body: { username, password },
  })
  if (error) return error.message

  const payload = data as {
    access_token?: string
    refresh_token?: string
    error?: string
  }
  if (payload.error) return payload.error
  if (!payload.access_token || !payload.refresh_token) {
    return 'Browser sign-in did not return a session.'
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })
  if (sessionError) return sessionError.message

  const { data: confirmed } = await supabase.auth.getSession()
  if (!confirmed.session?.user) return 'Sign-in did not stick — try again.'

  return null
}
