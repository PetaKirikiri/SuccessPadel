import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { consumeLineHandoffToken, linePlayerLinkQrUrl, resolveCompetitionPathAfterLink } from '../lib/line/playerLink'
import { lineSignInEntryUrl } from '../lib/line/liff'

export function LineAuthComplete() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const handoffToken = searchParams.get('handoffToken')
  const linkToken = searchParams.get('lpl')
  const contextId = searchParams.get('cid')
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
      try {
      const { competitionId, error: err } = await consumeLineHandoffToken(handoffToken)
      if (!active) return
      if (err) {
        if (/handoff token already used|invalid handoff token|expired/i.test(err)) {
          const destination = resolveCompetitionPathAfterLink(contextId)
          const resumeUrl = linkToken?.startsWith('lpl_')
            ? linePlayerLinkQrUrl(linkToken, contextId)
            : lineSignInEntryUrl(destination)
          // Re-verify LINE identity. A used token is never authentication.
          // Bound automatic recovery so a broken phone flow cannot redirect forever.
          const lastRecovery = Number(sessionStorage.getItem('sp-player-handoff-recovering') ?? 0)
          if (resumeUrl && Date.now() - lastRecovery > 60_000) {
            sessionStorage.setItem('sp-player-handoff-recovering', String(Date.now()))
            window.location.replace(resumeUrl)
            return
          }
        }
        setError(err)
        setBusy(false)
        return
      }
      sessionStorage.removeItem('sp-player-handoff-recovering')
      navigate(resolveCompetitionPathAfterLink(competitionId ?? contextId), { replace: true })
      } catch {
        if (active) { setError('Could not finish sign-in. Please try scanning again.'); setBusy(false) }
      }
    })()

    return () => {
      active = false
    }
  }, [handoffToken, linkToken, contextId, navigate])

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
          Your phone sign-in has not finished. Scan the player’s QR again in LINE to continue.
        </p>
        <Link to="/" className="brand-btn inline-block px-4 py-2 text-sm">
          Back to app
        </Link>
      </div>
    </div>
  )
}
