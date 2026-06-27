import type { ReactNode } from 'react'
import { AppShellColumn } from '../AppShellColumn'
import { AppShellPanel } from '../AppShellPanel'
import { PlayViewTabs, type PlayViewTab } from '../PlayViewTabs'
import type { TranslateFn } from '../../i18n'

type Props = {
  tab: PlayViewTab
  onTab: (tab: PlayViewTab) => void
  t: TranslateFn
  loadOrError: ReactNode
  session: unknown
  gamesBody: ReactNode
  leaderboardBody: ReactNode
  /** Hub game carousel manages its own scroll; leaderboard still scrolls in-panel. */
  scrollBody?: boolean
}

/** Phone, tablet, and normal web — one tabbed view at a time. */
export function CompetitionPlayStandardView({
  tab,
  onTab,
  t,
  loadOrError,
  session,
  gamesBody,
  leaderboardBody,
  scrollBody = true,
}: Props) {
  return (
    <AppShellColumn className="min-h-0 flex-1 overflow-hidden pt-1">
      <AppShellPanel
        scrollBody={scrollBody}
        footer={
          <nav className="app-shell-panel-footer gap-0" aria-label={t('aria.competitionViews')}>
            <PlayViewTabs tab={tab} onTab={onTab} t={t} />
          </nav>
        }
      >
        {scrollBody ? (
          <div className="app-shell-panel-inset space-y-3">
            {loadOrError}
            {session && tab === 'games' ? gamesBody : null}
            {session && tab === 'leaderboard' ? leaderboardBody : null}
          </div>
        ) : (
          <>
            {loadOrError}
            {session && tab === 'games' ? gamesBody : null}
            {session && tab === 'leaderboard' ? (
              <div className="app-shell-panel-inset min-h-0 flex-1 overflow-y-auto">
                {leaderboardBody}
              </div>
            ) : null}
          </>
        )}
      </AppShellPanel>
    </AppShellColumn>
  )
}
