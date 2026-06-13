import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'
import { competitionJoinUrl } from '../lib/siteUrl'
import { canJoinGame, rosterLabel } from '../lib/playerCaps'
import { supabase } from '../lib/supabaseClient'
import { IconAdd, IconDelete, IconJoin, IconPlay, IconReview } from './ButtonIcons'
import { IconHubCurrent, IconHubPast, shellTabClass } from './ShellTabIcons'
import { GamesHubEmpty, GamesHubLoading } from './GamesHubView'
import { CompetitionCurrentGameCard } from './CompetitionCurrentGameCard'
import { CompetitionGuestRoster } from './CompetitionGuestRoster'
import { CompetitionSetupPanel } from './CompetitionSetupPanel'
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

function CompetitionCard({
  row,
  userId,
  isAdmin,
  expanded,
  onToggle,
  onRefresh,
  past,
  t,
}: {
  row: CompetitionRow
  userId?: string
  isAdmin: boolean
  expanded: boolean
  onToggle: () => void
  onRefresh: () => void
  past: boolean
  t: TranslateFn
}) {
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const isLive = Boolean(row.competition_started_at) && row.status !== 'complete'
  const isComplete = row.status === 'complete'
  const canReviewScores = isComplete || Boolean(row.competition_started_at)
  const roster = row.session_players ?? []
  const playedOn = formatPastDate(row.competition_started_at ?? row.starts_at)
  const rosterCount = roster.length
  const target = row.target_players ?? row.max_players ?? null
  const joined = userId ? roster.some((sp) => sp.profile_id === userId) : false
  const spotsOpen = canJoinGame(row, rosterCount) && row.status === 'open'
  const canJoin = !joined && userId && spotsOpen

  const spots =
    target != null
      ? rosterLabel(rosterCount, target, row.player_cap_mode === 'flexible')
      : String(rosterCount)

  const join = async () => {
    setBusy(true)
    setJoinError(null)
    const { error: err } = await supabase.rpc('join_competition', { p_session_id: row.id })
    setBusy(false)
    if (err) setJoinError(err.message)
    else onRefresh()
  }

  const remove = async () => {
    const warning = isLive
      ? t('competition.deleteLiveConfirm', { title: row.title })
      : t('competition.deleteConfirm', { title: row.title })
    if (!window.confirm(warning)) return

    setBusy(true)
    setDeleteError(null)
    const { error: err } = await supabase.rpc('delete_competition_session', {
      p_session_id: row.id,
    })
    setBusy(false)
    if (err) setDeleteError(err.message)
    else onRefresh()
  }

  const header = (
    <>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-display text-sm font-semibold leading-snug text-brand-primary">
          {row.title}
        </p>
        {past && playedOn && (
          <p className="text-[11px] text-brand-muted">
            {t('competition.playedOn', { date: playedOn })}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
            {isLive && (
              <span className="rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                {t('competition.live')}
              </span>
            )}
            {isComplete && (
              <span className="rounded-full border border-brand-border px-2 py-0.5 text-[10px] font-medium text-brand-muted">
                {t('competition.done')}
              </span>
            )}
            {row.skill_level && (
              <span className="rounded-full bg-brand-bg-alt px-2 py-0.5 text-[10px] font-semibold text-brand-accent">
                {row.skill_level}
              </span>
            )}
            {row.gender && (
              <span className="rounded-full border border-brand-border px-2 py-0.5 text-[10px] font-semibold text-brand-sage">
                {row.gender}
              </span>
            )}
            <span className="rounded-full border border-brand-border px-2 py-0.5 text-[10px] font-medium text-brand-muted">
              {spots}
            </span>
          </div>
        </div>
      {!past && (
        <span className="shrink-0 pt-0.5 text-[10px] text-brand-muted">{expanded ? '▲' : '▼'}</span>
      )}
    </>
  )

  return (
    <article className="game-card overflow-hidden p-0">
      {past ? (
        <div className="flex w-full min-w-0 items-start gap-2 px-3 py-3">{header}</div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full min-w-0 items-start gap-2 px-3 py-3 text-left"
          aria-expanded={expanded}
        >
          {header}
        </button>
      )}

      {(past || expanded) && (
        <div className="space-y-3 border-t border-brand-border/50 px-3 py-3">
          {expanded && row.rules && (
            <p className="text-sm leading-relaxed text-brand-text">{row.rules}</p>
          )}

          {expanded && isAdmin && !past && (
            <div onClick={(e) => e.stopPropagation()}>
              <CompetitionGuestRoster
                sessionId={row.id}
                session={row}
                roster={roster}
                isAdmin
                onRefresh={onRefresh}
              />
            </div>
          )}

          {canReviewScores && (
            <Link
              to={`/competitions/${row.id}`}
              className="brand-btn w-full py-2"
              onClick={(e) => e.stopPropagation()}
            >
              <IconReview />
              {t('competition.reviewScores')}
            </Link>
          )}

          {!isAdmin && isLive && !isComplete && (
            <Link
              to={`/competitions/${row.id}`}
              className="brand-btn w-full py-2"
              onClick={(e) => e.stopPropagation()}
            >
              <IconPlay />
              {t('competition.play')}
            </Link>
          )}

          {!isAdmin && !isLive && joined && (
            <p className="text-center text-sm text-brand-muted">{t('competition.onRoster')}</p>
          )}

          {expanded && canJoin && !isAdmin && (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation()
                void join()
              }}
              className="brand-btn w-full py-2"
            >
              <IconJoin />
              {t('competition.join')}
            </button>
          )}

          {expanded && !isAdmin && !isLive && spotsOpen && !joined && userId && (
            <a
              href={competitionJoinUrl(row.id)}
              className="brand-btn w-full py-2"
              onClick={(e) => e.stopPropagation()}
            >
              <IconJoin />
              {t('competition.addYourself')}
            </a>
          )}

          {expanded && isAdmin && !past && rosterCount >= 4 && (
            <div onClick={(e) => e.stopPropagation()}>
              <CompetitionSetupPanel
                sessionId={row.id}
                session={row}
                roster={roster}
                onRefresh={onRefresh}
              />
            </div>
          )}

          {expanded && isAdmin && !past && (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation()
                void remove()
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
            >
              <IconDelete />
              {t('competition.deleteCompetition')}
            </button>
          )}

          {joinError && <p className="text-xs text-red-600">{joinError}</p>}
          {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
        </div>
      )}
    </article>
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
      ) : tab === 'current' ? (
        visibleRows.map((row) => (
          <CompetitionCurrentGameCard
            key={row.id}
            row={row}
            isAdmin={isAdmin}
            userId={userId}
            onRefresh={onRefresh}
          />
        ))
      ) : (
        visibleRows.map((row) => (
          <CompetitionCard
            key={row.id}
            row={row}
            userId={userId}
            isAdmin={isAdmin}
            past
            expanded={expandedId === row.id}
            onToggle={() => setExpandedId((id) => (id === row.id ? null : row.id))}
            onRefresh={onRefresh}
            t={t}
          />
        ))
      )}
    </div>
  )
}
