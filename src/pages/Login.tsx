import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authRedirectUrl } from '../lib/authRedirect'
import { consumeReturnTo, saveReturnTo } from '../lib/authReturnTo'
import { syncProfileForUser } from '../lib/authProfile'
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
  const fromPath = (location.state as { from?: string } | null)?.from

  useEffect(() => {
    if (fromPath) saveReturnTo(fromPath)
  }, [fromPath])

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

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden">
      <div
        data-scroll-y
        className="scroll-y login-panel min-h-0 min-w-0 max-h-full py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
      >
        <div className="mb-6 text-center">
          <img
            src="/brand/logo-padel.webp"
            alt="Success Padel"
            className="mx-auto h-14 w-auto max-w-[min(100%,11rem)]"
          />
          <h1 className="font-display mt-3 text-xl font-semibold text-brand-primary">{titles[mode]}</h1>
        </div>

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

        <div className="mt-4 space-y-2 text-center text-sm">
          {mode === 'sign-in' && (
            <>
              <p>
                <button type="button" onClick={() => switchMode('forgot')} className="brand-link">
                  Forgot password?
                </button>
              </p>
              <p className="game-subtle">
                No account?{' '}
                <button type="button" onClick={() => switchMode('sign-up')} className="brand-link">
                  Sign up
                </button>
              </p>
            </>
          )}
          {mode === 'sign-up' && (
            <p className="game-subtle">
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('sign-in')} className="brand-link">
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => switchMode('sign-in')} className="brand-link">
              Back to sign in
            </button>
          )}
        </div>

        {error && <p className="mt-4 break-words text-center text-sm text-red-600">{error}</p>}
        {info && <p className="mt-4 break-words text-center text-sm text-brand-primary">{info}</p>}
      </div>
    </div>
  )
}
