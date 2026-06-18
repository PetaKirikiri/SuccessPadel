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
  started: boolean
  starting?: boolean
  gamesBody: ReactNode
  leaderboardBody: ReactNode
}

/** Phone, tablet, and normal web — one tabbed view at a time. */
export function CompetitionPlayStandardView({
  tab,
  onTab,
  t,
  loadOrError,
  session,
  started,
  starting = false,
  gamesBody,
  leaderboardBody,
}: Props) {
  return (
    <AppShellColumn className="min-h-0 flex-1 overflow-hidden pt-1">
      <AppShellPanel
        footer={
          <nav className="app-shell-panel-footer gap-0" aria-label={t('aria.competitionViews')}>
            <PlayViewTabs tab={tab} onTab={onTab} t={t} />
          </nav>
        }
      >
        <div className="app-shell-panel-inset space-y-3">
          {loadOrError}
          {session && tab === 'games' ? (
            <>
              {!started ? (
                <p className="py-6 text-center text-sm text-brand-muted">
                  {starting ? t('common.loading') : t('competition.waitingOrganiser')}
                </p>
              ) : null}
              {started ? gamesBody : null}
            </>
          ) : null}
          {session && tab === 'leaderboard' ? leaderboardBody : null}
        </div>
      </AppShellPanel>
    </AppShellColumn>
  )
}
