import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authRedirectUrl } from '../lib/authRedirect'
import { consumeReturnTo, saveReturnTo } from '../lib/authReturnTo'
import { syncProfileForUser } from '../lib/authProfile'
import { signInWithLine, startLineLogin } from '../lib/line/auth'
import { hasLiffId, isInLineClient, isMobileWeb } from '../lib/line/liff'
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
  const fromPath = (location.state as { from?: string } | null)?.from

  useEffect(() => {
    if (fromPath) saveReturnTo(fromPath)
  }, [fromPath])

  useEffect(() => {
    if (!loading && session) {
      navigate(fromPath ?? consumeReturnTo('/'), { replace: true })
    }
  }, [loading, session, fromPath, navigate])

  const goAfterAuth = () => {
    navigate(fromPath ?? consumeReturnTo('/'), { replace: true })
  }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lineBusy, setLineBusy] = useState(false)
  const lineConfigured = hasLiffId()
  const inLineApp = isInLineClient()
  const mobile = isMobileWeb()
  const lineFirst = mobile && !inLineApp && lineConfigured
  const [showEmail, setShowEmail] = useState(!lineFirst)
  const autoLineStarted = useRef(false)

  useEffect(() => {
    if (!lineConfigured || !inLineApp) return
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
  }, [lineConfigured, inLineApp])

  useEffect(() => {
    if (!lineFirst || showEmail || loading || session || autoLineStarted.current) return
    autoLineStarted.current = true
    setLineBusy(true)
    const returnPath = fromPath ?? consumeReturnTo('/login')
    void (async () => {
      const { error: lineError, redirected } = await startLineLogin(returnPath)
      if (redirected) return
      setLineBusy(false)
      if (lineError) setError(lineError)
    })()
  }, [lineFirst, showEmail, loading, session, fromPath])

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

  const lineButtonLabel = lineBusy
    ? 'Connecting…'
    : inLineApp
      ? 'Continue with LINE'
      : isMobileWeb()
        ? 'Open LINE app to sign in'
        : 'Open in LINE to sign in'

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

      setInfo(
        `Reset email sent. Open the link on this device at ${window.location.origin} — not localhost.`,
      )
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

      setInfo(
        `Check your email to confirm your account. Open the link on this device at ${window.location.origin}.`,
      )
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

  const showPasswordFields = mode === 'sign-in' || mode === 'sign-up'
  const showLine = mode === 'sign-in' || mode === 'sign-up'
  const signingInViaLine = inLineApp && lineConfigured && lineBusy && !error

  if (signingInViaLine || (lineFirst && !showEmail && lineBusy && !error)) {
    return (
      <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center overflow-hidden px-6">
        <img
          src="/brand/logo-padel.webp"
          alt="Success Padel"
          className="mb-6 h-14 w-auto max-w-[min(100%,11rem)]"
        />
        <p className="font-display text-lg font-semibold text-brand-primary">Opening LINE…</p>
        <p className="mt-2 text-center text-sm text-brand-muted">Tap Allow in LINE to continue.</p>
      </div>
    )
  }

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
            className="mx-auto h-14 w-auto max-w-[min(100%,11rem)]"
          />
          <h1 className="font-display mt-3 text-xl font-semibold text-brand-primary">
            {lineFirst && !showEmail ? 'Sign in with LINE' : titles[mode]}
          </h1>
        </div>

        {lineFirst && !showEmail && showLine && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={busy || lineBusy}
              onClick={() => void handleLineLogin()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] py-3 text-base font-semibold text-white disabled:opacity-60"
            >
              {lineButtonLabel}
            </button>
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="brand-link block w-full text-center text-sm"
            >
              Use email instead
            </button>
          </div>
        )}

        {showEmail && mode !== 'forgot' && (
          <div
            className="mb-5 flex rounded-xl border border-brand-border bg-brand-surface p-1"
            role="tablist"
            aria-label="Sign in or sign up"
          >
            {(['sign-in', 'sign-up'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
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

        {showEmail && showLine && (
          <div className="mb-4 space-y-3">
            <button
              type="button"
              disabled={busy || lineBusy}
              onClick={() => void handleLineLogin()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {lineButtonLabel}
            </button>
            <p className="text-center text-xs text-brand-muted">or use email</p>
          </div>
        )}

        {showEmail && (
        <form onSubmit={submit} className="w-full min-w-0 space-y-3">
          {mode === 'sign-up' && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="brand-input"
              aria-label="Your name"
              autoComplete="name"
              autoCapitalize="words"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="brand-input"
            aria-label="Email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            required
          />
          {showPasswordFields && (
            <div className="box-border flex w-full min-w-0 items-stretch overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-base text-brand-text outline-none placeholder:text-brand-muted"
                aria-label="Password"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 px-3 text-xs font-medium text-brand-muted"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          )}
          {mode === 'sign-up' && (
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="brand-input"
              aria-label="Confirm password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          )}
          <button type="submit" disabled={busy} className="brand-btn w-full font-semibold">
            {mode === 'forgot' ? 'Send reset email' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        )}

        {showEmail && (
        <div className="mt-4 space-y-2 text-center text-sm">
          {mode === 'sign-in' && (
            <p>
              <button type="button" onClick={() => switchMode('forgot')} className="brand-link">
                Forgot password?
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => switchMode('sign-in')} className="brand-link">
              Back to sign in
            </button>
          )}
        </div>
        )}

        {error && <p className="mt-4 break-words text-center text-sm text-red-600">{error}</p>}
        {info && <p className="mt-4 break-words text-center text-sm text-brand-primary">{info}</p>}
      </div>
    </div>
  )
}
