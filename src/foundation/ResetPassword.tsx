import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (err) {
      setError(err.message)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden">
      <div className="login-panel min-w-0 py-8">
        <h1 className="font-display mb-2 text-center text-xl font-semibold text-brand-primary">
          Set new password
        </h1>
        <p className="game-subtle mb-6 text-center text-xs">Choose a password for your account.</p>

        <form onSubmit={submit} className="w-full min-w-0 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="brand-input"
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            className="brand-input"
            autoComplete="new-password"
            required
          />
          <button type="submit" disabled={busy} className="brand-btn w-full font-semibold">
            Save password
          </button>
        </form>

        {error && <p className="mt-4 break-words text-center text-sm text-red-600">{error}</p>}

        <p className="game-subtle mt-6 text-center text-xs">
          <Link to="/friendly" className="brand-link">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
