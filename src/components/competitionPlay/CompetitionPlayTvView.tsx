import type { ReactNode } from 'react'
import type { TranslateFn } from '../../i18n'

type Props = {
  t: TranslateFn
  loadOrError: ReactNode
  session: unknown
  gamesBody: ReactNode
  leaderboardBody: ReactNode
  leaderboardLabel?: string
}

/** TV only (≥1536px) — blended games + standings. */
export function CompetitionPlayTvView({
  t,
  loadOrError,
  session,
  gamesBody,
  leaderboardBody,
  leaderboardLabel,
}: Props) {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="tv-play-layout min-h-0 flex-1">
          <div className="tv-play-games min-h-0">
            <div className="tv-play-scroll min-h-0">
              {loadOrError}
              {session ? gamesBody : null}
            </div>
          </div>
          {session ? (
            <aside className="tv-play-standings" aria-label={leaderboardLabel ?? t('leaderboard.standings')}>
              <div className="tv-play-standings-body">{leaderboardBody}</div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}
