import type { ReactNode } from 'react'
import { AppShellPanel } from '../AppShellPanel'
import type { TranslateFn } from '../../i18n'

type Props = {
  t: TranslateFn
  loadOrError: ReactNode
  session: unknown
  gamesBody: ReactNode
  leaderboardBody: ReactNode
}

/** TV only (≥1536px) — blended games + standings. */
export function CompetitionPlayTvView({
  t,
  loadOrError,
  session,
  gamesBody,
  leaderboardBody,
}: Props) {
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <AppShellPanel scrollBody={false} className="tv-play-panel" footer={null}>
        <div className="tv-play-layout">
          <div className="tv-play-games">
            <div className="tv-play-scroll app-shell-panel-inset">
              {loadOrError}
              {session ? gamesBody : null}
            </div>
          </div>
          {session ? (
            <aside className="tv-play-standings" aria-label={t('leaderboard.standings')}>
              <div className="tv-play-scroll">{leaderboardBody}</div>
            </aside>
          ) : null}
        </div>
      </AppShellPanel>
    </div>
  )
}
