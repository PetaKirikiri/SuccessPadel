import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { consumeReturnTo } from '../lib/authReturnTo'
import { completeLineOAuthFromUrl } from '../lib/line/oauth'

export function LineAuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      const err = await completeLineOAuthFromUrl(window.location.search)
      if (!active) return
      if (err) setError(err)
      else navigate(consumeReturnTo('/'), { replace: true })
    })()

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
