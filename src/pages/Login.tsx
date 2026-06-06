import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authRedirectUrl } from '../lib/authRedirect'
import { consumeReturnTo, saveReturnTo } from '../lib/authReturnTo'
import { syncProfileForUser } from '../lib/authProfile'
import { isLineLoginConfigured, signInWithLine, startLineLogin } from '../lib/line/auth'
import { hasLiffId, isInLineClient } from '../lib/line/liff'
import { completeLineOAuthFromUrl, lineOAuthCallbackCode } from '../lib/line/oauth'
import { supabase } from '../lib/supabaseClient'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot'

function authErrorMessage(message: string): string {
  if (/rate limit|over_email_send/i.test(message)) {
    return 'Too many emails sent. Wait about an hour, or sign in if you already have an account.'
  }
  return message
}

const titles: Record<AuthMode, string> = {
  'sign-in': 'Welcome back',
  'sign-up': 'Create account',
  forgot: 'Reset password',
}

function SigningInScreen({ message }: { message: string }) {
  return (
    <div className="game-bg flex h-full min-h-0 w-full flex-col items-center justify-center px-6">
      <img
        src="/brand/logo-padel.webp"
        alt="Success Padel"
        className="mb-6 h-14 w-auto max-w-[min(100%,11rem)]"
      />
      <p className="font-display text-lg font-semibold text-brand-primary">{message}</p>
    </div>
  )
}

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useAuth()
  const fromPath = (location.state as { from?: string } | null)?.from
  const lineEnabled = isLineLoginConfigured()
  const inLineApp = isInLineClient()

  const adminEmail = new URLSearchParams(location.search).get('email') === '1'
  const [showEmail, setShowEmail] = useState(!lineEnabled || adminEmail)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword] = useState(false)
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lineBusy, setLineBusy] = useState(false)

  useEffect(() => {
    if (fromPath) saveReturnTo(fromPath)
  }, [fromPath])

  useEffect(() => {
    const code = lineOAuthCallbackCode(location.search)
    if (!code) return

    let active = true
    setLineBusy(true)
    void (async () => {
      const err = await completeLineOAuthFromUrl(location.search)
      if (!active) return
      if (err) {
        setLineBusy(false)
        setError(err)
        navigate('/login', { replace: true })
        return
      }
      navigate(fromPath ?? consumeReturnTo('/'), { replace: true })
    })()

    return () => {
      active = false
    }
  }, [location.search, fromPath, navigate])

  useEffect(() => {
    if (!loading && session) {
      navigate(fromPath ?? consumeReturnTo('/'), { replace: true })
    }
  }, [loading, session, fromPath, navigate])

  const goAfterAuth = () => {
    navigate(fromPath ?? consumeReturnTo('/'), { replace: true })
  }

  useEffect(() => {
    if (!hasLiffId() || !inLineApp) return
    let cancelled = false
    void (async () => {
      setLineBusy(true)
      const { error: lineError, redirected } = await signInWithLine()
      if (cancelled || redirected) return
      setLineBusy(false)
      if (lineError) setError(lineError)
      else goAfterAuth()
    })()
    return () => {
      cancelled = true
    }
  }, [inLineApp])

  const handleLineLogin = async () => {
    setError(null)
    setLineBusy(true)
    const returnPath = fromPath ?? consumeReturnTo('/login')
    const { error: lineError, redirected } = await startLineLogin(returnPath)
    if (redirected) return
    setLineBusy(false)
    if (lineError) setError(lineError)
    else goAfterAuth()
  }

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
    setInfo(null)
    if (next !== 'sign-up') setConfirmPassword('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)

    const trimmedEmail = email.trim().toLowerCase()

    if (mode === 'forgot') {
      const { error: err } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: authRedirectUrl('/auth/callback'),
      })
      setBusy(false)
      if (err) {
        setError(authErrorMessage(err.message))
        return
      }
      setInfo(`Reset email sent. Open the link on this device at ${window.location.origin}.`)
      return
    }

    if (mode === 'sign-up') {
      if (password.length < 8) {
        setBusy(false)
        setError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirmPassword) {
        setBusy(false)
        setError('Passwords do not match.')
        return
      }

      const name = displayName.trim() || trimmedEmail.split('@')[0]
      const { data, error: err } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: authRedirectUrl('/auth/callback'),
          data: { display_name: name },
        },
      })
      setBusy(false)

      if (err) {
        setError(authErrorMessage(err.message))
        return
      }

      if (data.session?.user) {
        await syncProfileForUser(data.session.user)
        goAfterAuth()
        return
      }

      if (fromPath) saveReturnTo(fromPath)
      setInfo(`Check your email to confirm your account.`)
      return
    }

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })
    setBusy(false)

    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Wrong email or password.'
          : authErrorMessage(err.message),
      )
      return
    }

    if (data.user) {
      await syncProfileForUser(data.user)
      goAfterAuth()
    }
  }

  if (lineBusy && !error) {
    return <SigningInScreen message={inLineApp ? 'Signing you in…' : 'Opening LINE…'} />
  }

  if (!showEmail && lineEnabled) {
    return (
      <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        <div className="login-panel mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
          <div className="mb-10 text-center">
            <img
              src="/brand/logo-padel.webp"
              alt="Success Padel"
              className="mx-auto h-16 w-auto max-w-[min(100%,12rem)]"
            />
            <h1 className="font-display mt-4 text-2xl font-semibold text-brand-primary">Success Padel</h1>
            <p className="mt-2 text-sm text-brand-muted">No email needed — we use your LINE name</p>
          </div>

          <button
            type="button"
            disabled={lineBusy}
            onClick={() => void handleLineLogin()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] py-3.5 text-base font-semibold text-white disabled:opacity-60"
          >
            Continue with LINE
          </button>

          <p className="mt-3 text-center text-xs text-brand-muted">
            LINE app opens → tap Allow → done
          </p>

          {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
        </div>
      </div>
    )
  }

  const showPasswordFields = mode === 'sign-in' || mode === 'sign-up'

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div
        data-scroll-y
        className="scroll-y login-panel mx-auto min-h-0 w-full max-w-md flex-1 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {lineEnabled && (
          <button
            type="button"
            onClick={() => {
              setShowEmail(false)
              setError(null)
              setInfo(null)
            }}
            className="mb-4 text-sm font-medium text-brand-accent"
          >
            ← Back to LINE
          </button>
        )}

        <div className="mb-5 text-center">
          <h1 className="font-display text-xl font-semibold text-brand-primary">{titles[mode]}</h1>
        </div>

        {mode !== 'forgot' && (
          <div className="mb-5 flex rounded-xl border border-brand-border bg-brand-surface p-1">
            {(['sign-in', 'sign-up'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchMode(tab)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  mode === tab
                    ? 'bg-brand-accent text-white shadow-sm'
                    : 'text-brand-muted hover:text-brand-text'
                }`}
              >
                {tab === 'sign-in' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="w-full min-w-0 space-y-3">
          {mode === 'sign-up' && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="brand-input"
              autoComplete="name"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="brand-input"
            autoComplete="email"
            inputMode="email"
            required
          />
          {showPasswordFields && (
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="brand-input"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              required
            />
          )}
          {mode === 'sign-up' && (
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="brand-input"
              autoComplete="new-password"
              required
            />
          )}
          <button type="submit" disabled={busy} className="brand-btn w-full font-semibold">
            {mode === 'forgot' ? 'Send reset email' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          {mode === 'sign-in' && (
            <button type="button" onClick={() => switchMode('forgot')} className="brand-link">
              Forgot password?
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => switchMode('sign-in')} className="brand-link">
              Back to sign in
            </button>
          )}
        </div>

        {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
        {info && <p className="mt-4 text-center text-sm text-brand-primary">{info}</p>}
      </div>
    </div>
  )
}
