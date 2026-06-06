import { Link, useSearchParams } from 'react-router-dom'
import { GameSettingsSummary } from '../components/GameSettingsSummary'
import { MatchForm } from '../components/MatchForm'
import { useActiveSession } from '../hooks/useWeekMatches'

export function Week() {
  const [search] = useSearchParams()
  const sessionId = search.get('session')
  const { session, roster, pairs, matches, loading, refresh } = useActiveSession(sessionId)

  if (loading) return <p className="game-subtle">Loading…</p>
  if (!session) {
    return (
      <p className="game-subtle text-center">
        No open game this week.{' '}
        <Link to="/admin/games" className="brand-link">
          Admin
        </Link>
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="game-heading text-xl">{session.title}</h2>
        <p className="game-subtle text-xs">
          {session.starts_on} – {session.ends_on}
        </p>
        <div className="mt-2">
          <GameSettingsSummary session={session} rosterCount={roster.length} />
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-medium text-brand-primary">Log match</h3>
        {roster.length >= 4 ? (
          <MatchForm session={session} roster={roster} pairs={pairs} onSaved={refresh} />
        ) : (
          <p className="game-subtle">Need at least 4 players on roster.</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-brand-primary">Matches</h3>
          <Link
            to={`/match/new?session=${session.id}`}
            className="text-sm brand-link"
          >
            GPT assist
          </Link>
        </div>
        <ul className="space-y-2">
          {matches.map((m) => (
            <li key={m.id} className="game-card px-3 py-2 text-sm">
              <span className="font-medium">{m.score_summary}</span>
              <p className="game-subtle text-xs">
                {m.match_players
                  .map((mp) => `${mp.profiles.display_name}${mp.is_winner ? ' ✓' : ''}`)
                  .join(' · ')}
              </p>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="game-subtle">No matches yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
