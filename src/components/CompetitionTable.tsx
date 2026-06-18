import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'
import { IconAdd } from './ButtonIcons'
import { IconHubCurrent, IconHubPast, shellTabClass } from './ShellTabIcons'
import { GamesHubEmpty, GamesHubLoading } from './GamesHubView'
import { SessionInviteCard } from './SessionInviteCard'
import type { CompetitionRow } from '../hooks/useCompetitions'
import { competitionIsPast } from '../lib/competitionListCard'

export type CompetitionListTab = 'current' | 'past'

type Props = {
  rows: CompetitionRow[]
  loading?: boolean
  error?: string | null
  isAdmin: boolean
  userId?: string
  onRefresh: () => void
  listTab?: CompetitionListTab
  showListTabs?: boolean
}

export function splitCompetitionRows(rows: CompetitionRow[], now = Date.now()) {
  const current: CompetitionRow[] = []
  const past: CompetitionRow[] = []
  for (const row of rows) {
    if (competitionIsPast(row, now)) past.push(row)
    else current.push(row)
  }
  past.sort((a, b) => {
    const ta = Date.parse(a.competition_started_at ?? a.starts_at ?? '')
    const tb = Date.parse(b.competition_started_at ?? b.starts_at ?? '')
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
  })
  return { currentRows: current, pastRows: past }
}

function formatPastDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function ListTabs({
  tab,
  onTab,
  currentCount,
  pastCount,
  t,
}: {
  tab: CompetitionListTab
  onTab: (t: CompetitionListTab) => void
  currentCount: number
  pastCount: number
  t: TranslateFn
}) {
  return (
    <div className="game-dock-inner">
      <button
        type="button"
        onClick={() => onTab('current')}
        className={shellTabClass(tab === 'current', 'competition')}
      >
        <IconHubCurrent />
        <span className="truncate text-xs leading-tight md:text-sm">
          {t('competition.currentGames')}
          {currentCount > 0 ? ` (${currentCount})` : ''}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onTab('past')}
        className={shellTabClass(tab === 'past', 'rank')}
      >
        <IconHubPast />
        <span className="truncate text-xs leading-tight md:text-sm">
          {t('competition.pastGames')}
          {pastCount > 0 ? ` (${pastCount})` : ''}
        </span>
      </button>
    </div>
  )
}

export function CompetitionTable({
  rows,
  loading,
  error,
  isAdmin,
  userId,
  onRefresh,
  listTab,
  showListTabs = true,
}: Props) {
  const { t } = useTranslation()
  const [internalTab, setInternalTab] = useState<CompetitionListTab>('current')
  const didDefaultTab = useRef(false)

  const { currentRows, pastRows } = useMemo(() => splitCompetitionRows(rows), [rows])

  const tab = listTab ?? internalTab
  const visibleRows = tab === 'past' ? pastRows : currentRows

  useEffect(() => {
    if (!showListTabs || loading || didDefaultTab.current) return
    didDefaultTab.current = true
    if (currentRows.length === 0 && pastRows.length > 0) setInternalTab('past')
  }, [showListTabs, loading, currentRows.length, pastRows.length])

  const listClass = showListTabs ? 'space-y-3' : 'space-y-4'

  return (
    <div className={listClass}>
      {showListTabs ? (
        <ListTabs
          tab={tab}
          onTab={setInternalTab}
          currentCount={currentRows.length}
          pastCount={pastRows.length}
          t={t}
        />
      ) : null}

      {error && <p className="px-1 text-center text-xs text-red-600">{error}</p>}

      {loading ? (
        showListTabs ? (
          <p className="py-6 text-center text-xs text-brand-muted">{t('common.loading')}</p>
        ) : (
          <GamesHubLoading />
        )
      ) : visibleRows.length === 0 ? (
        showListTabs ? (
          <div className="game-card space-y-2 px-4 py-5 text-center">
            <p className="text-sm text-brand-text">
              {tab === 'past' ? t('competition.noPastGames') : t('competition.noCurrentGames')}
            </p>
            {tab === 'current' && isAdmin ? (
              <>
                <Link to="/competitions/new" className="brand-btn px-6 py-2">
                  <IconAdd />
                  {t('competition.addCompetition')}
                </Link>
                <p className="text-xs text-brand-muted">{t('competition.tapPlusHint')}</p>
              </>
            ) : tab === 'current' ? (
              <p className="text-xs text-brand-muted">{t('competition.checkBackHint')}</p>
            ) : null}
          </div>
        ) : (
          <GamesHubEmpty>
            <p>
              {tab === 'past' ? t('competition.noPastGames') : t('competition.noCurrentGames')}
            </p>
            {tab === 'current' && isAdmin ? (
              <>
                <Link to="/competitions/new" className="brand-btn px-6 py-2">
                  <IconAdd />
                  {t('competition.addCompetition')}
                </Link>
                <p className="text-xs text-brand-muted">{t('competition.tapPlusHint')}</p>
              </>
            ) : tab === 'current' ? (
              <p className="text-xs text-brand-muted">{t('competition.checkBackHint')}</p>
            ) : null}
          </GamesHubEmpty>
        )
      ) : (
        visibleRows.map((row) => {
          const playedOn = formatPastDate(row.competition_started_at ?? row.starts_at)
          return (
            <SessionInviteCard
              key={row.id}
              kind="competition"
              row={row}
              isAdmin={isAdmin}
              userId={userId}
              onRefresh={onRefresh}
              statusLine={
                tab === 'past' && playedOn
                  ? t('competition.playedOn', { date: playedOn })
                  : undefined
              }
            />
          )
        })
      )}
    </div>
  )
}
