import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { consumeReturnTo } from '../lib/authReturnTo'
import { syncProfileForUser } from '../lib/authProfile'
import { consumeLineOAuthState, lineOAuthRedirectUri } from '../lib/line/oauth'
import { supabase } from '../lib/supabaseClient'

export function LineAuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const finish = async () => {
      const params = new URLSearchParams(window.location.search)
      const oauthError = params.get('error_description') ?? params.get('error')
      if (oauthError) {
        if (active) setError(oauthError)
        return
      }

      const code = params.get('code')
      const state = params.get('state')
      if (!code || !consumeLineOAuthState(state)) {
        if (active) setError('LINE sign-in failed. Please try again.')
        return
      }

      const { data, error: fnError } = await supabase.functions.invoke('line-oauth', {
        body: { code, redirect_uri: lineOAuthRedirectUri() },
      })

      if (!active) return

      if (fnError) {
        setError(fnError.message)
        return
      }

      const payload = data as {
        error?: string
        access_token?: string
        refresh_token?: string
      }

      if (payload.error) {
        setError(payload.error)
        return
      }

      if (!payload.access_token || !payload.refresh_token) {
        setError('Sign-in failed — no session returned.')
        return
      }

      const { data: sessionData, error: sessErr } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      })

      if (sessErr) {
        setError(sessErr.message)
        return
      }

      if (sessionData.user) {
        await syncProfileForUser(sessionData.user)
      }

      navigate(consumeReturnTo('/'), { replace: true })
    }

    void finish()

    return () => {
      active = false
    }
  }, [navigate])

  if (error) {
    return (
      <div className="game-bg flex h-full min-h-0 w-full items-center justify-center px-4">
        <div className="login-panel space-y-3 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Link to="/login" className="brand-link text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="game-bg flex h-full min-h-0 w-full items-center justify-center px-4">
      <p className="game-subtle text-center text-sm">Finishing LINE sign-in…</p>
    </div>
  )
}
