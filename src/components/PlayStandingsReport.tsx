import type { ReactNode } from 'react'
import { useTranslation } from '../hooks/useTranslation'

type Props = {
  children: ReactNode
}

/** Fixed standings panel — visible from lg breakpoint up (see index.css). */
export function PlayStandingsReport({ children }: Props) {
  const { t } = useTranslation()

  return (
    <aside className="play-standings-report pointer-events-auto" aria-label={t('leaderboard.standings')}>
      <p className="border-b border-brand-border/60 bg-brand-bg-alt px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
        {t('leaderboard.standings')} · {t('leaderboard.largeScreen')}
      </p>
      <div className="play-standings-report-body">{children}</div>
    </aside>
  )
}
