import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authRedirectUrl } from '../lib/authRedirect'
import { consumeReturnTo, saveReturnTo } from '../lib/authReturnTo'
import { syncProfileForUser } from '../lib/authProfile'
import { LineNativeLoginPanel } from '../components/LineNativeLoginPanel'
import { isLineLoginConfigured, startLineLogin } from '../lib/line/auth'
import { linkTokenFromLocation } from '../lib/line/playerLink'
import { isNativeApp } from '../lib/native/app'
import { lineOAuthCallbackCode } from '../lib/line/oauth'
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

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useAuth()
  const loginState = (location.state as { from?: string } | null) ?? {}
  const fromPath = loginState.from
  const searchParams = new URLSearchParams(location.search)
  const forceEmail = searchParams.get('email') === '1'
  const nativeApp = isNativeApp()
  const lineEnabled = isLineLoginConfigured()
  const playerLinkEntry = Boolean(linkTokenFromLocation(location.search))

  const [showEmail, setShowEmail] = useState(forceEmail && !nativeApp)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lineBusy, setLineBusy] = useState(false)
  const linkState = searchParams.get('state')
  const isPlayerLinkReturn = Boolean(linkState?.startsWith('lpl_'))
  const oauthReturning =
    Boolean(lineOAuthCallbackCode(location.search)) || isPlayerLinkReturn

  useEffect(() => {
    if (fromPath) saveReturnTo(fromPath)
  }, [fromPath])

  useEffect(() => {
    const lineError = (location.state as { lineError?: string } | null)?.lineError
    if (lineError) setError(lineError)
  }, [location.state])

  useEffect(() => {
    setShowEmail(forceEmail)
  }, [forceEmail])

  useEffect(() => {
    if (!loading && session && !oauthReturning) {
      navigate(fromPath ?? consumeReturnTo('/'), { replace: true })
    }
  }, [loading, session, fromPath, navigate, oauthReturning])

  useEffect(() => {
    if (nativeApp || oauthReturning || playerLinkEntry || forceEmail || showEmail) return
    navigate('/', { replace: true })
  }, [nativeApp, oauthReturning, playerLinkEntry, forceEmail, showEmail, navigate])

  const goAfterAuth = () => {
    navigate(fromPath ?? consumeReturnTo('/'), { replace: true })
  }

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
      setInfo('Check your email to confirm your account.')
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

  if (oauthReturning || playerLinkEntry) return null

  if (!showEmail) {
    if (!nativeApp) return null

    return (
      <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        <div className="login-panel mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
          {!lineEnabled && (
            <p className="mb-6 text-center text-sm text-red-600">
              LINE is not configured — set <code className="text-xs">VITE_LINE_CHANNEL_ID</code> in{' '}
              <code className="text-xs">.env.local</code> and restart the dev server.
            </p>
          )}
          <LineNativeLoginPanel busy={lineBusy} onContinue={() => void handleLineLogin()} />
          {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}
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
        <div className="mb-5 text-center">
          <img
            src="/brand/logo-padel.webp"
            alt="Success Padel"
            className="mx-auto mb-3 h-12 w-auto max-w-[min(100%,10rem)]"
          />
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
              type="password"
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
              type="password"
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
