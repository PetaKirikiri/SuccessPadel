import type { ReactNode } from 'react'
import { AppShellColumn } from '../AppShellColumn'
import { AppShellPanel } from '../AppShellPanel'
import type { TranslateFn } from '../../i18n'
import { TvPlayQrPanel } from './TvPlayQrPanel'

type Props = {
  t: TranslateFn
  loadOrError: ReactNode
  session: unknown
  started: boolean
  gamesBody: ReactNode
  leaderboardBody: ReactNode
  viewAlongUrl: string | null
  showQr: boolean
}

/** TV only (≥1536px) — blended games + standings, QR in standings column. */
export function CompetitionPlayTvView({
  t,
  loadOrError,
  session,
  started,
  gamesBody,
  leaderboardBody,
  viewAlongUrl,
  showQr,
}: Props) {
  return (
    <AppShellColumn edgeToEdge className="overflow-hidden pt-0">
      <AppShellPanel scrollBody={false} className="tv-play-panel" footer={null}>
        <div className="tv-play-layout">
          <div className="tv-play-games">
            <div className="tv-play-scroll app-shell-panel-inset space-y-3">
              {loadOrError}
              {session && !started && !gamesBody ? (
                <p className="py-6 text-center text-sm text-brand-muted">
                  {t('competition.waitingOrganiser')}
                </p>
              ) : null}
              {session ? gamesBody : null}
            </div>
          </div>
          {session ? (
            <aside className="tv-play-standings" aria-label={t('leaderboard.standings')}>
              <div className="tv-play-scroll">{leaderboardBody}</div>
              {showQr && viewAlongUrl ? (
                <div className="tv-play-qr-dock">
                  <TvPlayQrPanel url={viewAlongUrl} />
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      </AppShellPanel>
    </AppShellColumn>
  )
}
