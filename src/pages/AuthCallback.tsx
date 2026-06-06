import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { consumeReturnTo } from '../lib/authReturnTo'
import { syncProfileForUser } from '../lib/authProfile'
import { supabase } from '../lib/supabaseClient'

export function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Finishing sign-in…')

  useEffect(() => {
    let active = true

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return

      if (event === 'PASSWORD_RECOVERY') {
        setStatus('Choose a new password…')
        navigate('/auth/reset-password', { replace: true })
        return
      }

      if (event === 'SIGNED_IN' && session?.user) {
        setStatus('Signed in. Redirecting…')
        void syncProfileForUser(session.user).then(() => {
          if (active) navigate(consumeReturnTo('/'), { replace: true })
        })
      }
    })

    const finish = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const hash = window.location.hash.replace(/^#/, '')
      const hashParams = new URLSearchParams(hash)
      const isRecovery =
        hashParams.get('type') === 'recovery' || params.get('type') === 'recovery'

      if (code) {
        setStatus('Verifying link…')
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!active) return
        if (exchangeError) {
          setError(exchangeError.message)
          return
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!active) return

      if (sessionError) {
        setError(sessionError.message)
        return
      }

      if (isRecovery && data.session) {
        navigate('/auth/reset-password', { replace: true })
        return
      }

      if (data.session?.user) {
        await syncProfileForUser(data.session.user)
        navigate(consumeReturnTo('/'), { replace: true })
        return
      }

      if (!code && !hash) {
        setError('This sign-in link is invalid or has expired.')
      }
    }

    void finish()

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [navigate])

  if (error) {
    return (
      <div className="game-bg flex h-full min-h-0 w-full items-center justify-center px-4">
        <div className="login-panel space-y-3 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <p className="game-subtle text-xs">
            Recovery links must open on the same address you used in the app (e.g. your phone’s{' '}
            <span className="font-mono">172.20.x.x:5173</span> URL, not localhost).
          </p>
          <Link to="/login" className="brand-link text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="game-bg flex h-full min-h-0 w-full items-center justify-center px-4">
      <p className="game-subtle text-center text-sm">{status}</p>
    </div>
  )
}
