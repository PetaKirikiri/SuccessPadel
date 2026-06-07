import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { consumeLineHandoffToken, resolveCompetitionPathAfterLink } from '../lib/line/playerLink'

export function LineAuthComplete() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const handoffToken = searchParams.get('handoffToken')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    if (!handoffToken) {
      setError('Missing handoff token. Please try linking again.')
      setBusy(false)
      return
    }

    let active = true

    void (async () => {
      const { competitionId, error: err } = await consumeLineHandoffToken(handoffToken)
      if (!active) return
      if (err) {
        setError(err)
        setBusy(false)
        return
      }
      navigate(resolveCompetitionPathAfterLink(competitionId), { replace: true })
    })()

    return () => {
      active = false
    }
  }, [handoffToken, navigate])

  if (busy) {
    return (
      <div className="game-bg flex h-full min-h-0 w-full items-center justify-center px-4">
        <p className="game-subtle text-center text-sm">Finishing account link…</p>
      </div>
    )
  }

  return (
    <div className="game-bg flex h-full min-h-0 w-full items-center justify-center px-4">
      <div className="login-panel max-w-sm space-y-3 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <p className="text-xs text-brand-muted">
          The link may have expired or already been used. Go back to the leaderboard and tap
          &ldquo;Link to my account&rdquo; again.
        </p>
        <Link to="/" className="brand-btn inline-block px-4 py-2 text-sm">
          Back to app
        </Link>
      </div>
    </div>
  )
}
