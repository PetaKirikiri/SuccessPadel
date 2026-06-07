import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { competitionJoinUrl } from '../lib/siteUrl'
import { canJoinGame, rosterLabel } from '../lib/playerCaps'
import { supabase } from '../lib/supabaseClient'
import { CompetitionCurrentGameCard } from './CompetitionCurrentGameCard'
import { CompetitionGuestRoster } from './CompetitionGuestRoster'
import { CompetitionSetupPanel } from './CompetitionSetupPanel'
import type { CompetitionRow } from '../hooks/useCompetitions'

type ListTab = 'current' | 'past'

type Props = {
  rows: CompetitionRow[]
  loading?: boolean
  error?: string | null
  isAdmin: boolean
  userId?: string
  onRefresh: () => void
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
}: {
  tab: ListTab
  onTab: (t: ListTab) => void
  currentCount: number
  pastCount: number
}) {
  return (
    <div className="game-dock-inner">
      <button
        type="button"
        onClick={() => onTab('current')}
        className={`game-tab game-tab-competition ${tab === 'current' ? 'game-tab-selected' : ''}`}
      >
        <span className="font-display text-sm leading-tight">
          Current Games{currentCount > 0 ? ` (${currentCount})` : ''}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onTab('past')}
        className={`game-tab game-tab-rank ${tab === 'past' ? 'game-tab-selected' : ''}`}
      >
        <span className="font-display text-sm leading-tight">
          Past Games{pastCount > 0 ? ` (${pastCount})` : ''}
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
}: {
  row: CompetitionRow
  userId?: string
  isAdmin: boolean
  expanded: boolean
  onToggle: () => void
  onRefresh: () => void
  past: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const isLive = Boolean(row.competition_started_at) && row.status !== 'complete'
  const isComplete = row.status === 'complete'
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
      ? `"${row.title}" is live. Delete anyway? Scores and roster will be lost.`
      : `Delete "${row.title}"? This cannot be undone.`
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
        {past && playedOn && <p className="text-[11px] text-brand-muted">Played {playedOn}</p>}
        <div className="flex flex-wrap gap-1.5">
            {isLive && (
              <span className="rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                Live
              </span>
            )}
            {isComplete && (
              <span className="rounded-full border border-brand-border px-2 py-0.5 text-[10px] font-medium text-brand-muted">
                Done
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

          {isComplete && (
            <Link
              to={`/competitions/${row.id}`}
              className="brand-btn block w-full py-2 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              Review scores
            </Link>
          )}

          {!isAdmin && isLive && !isComplete && (
            <Link
              to={`/competitions/${row.id}`}
              className="brand-btn block w-full py-2 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              Play
            </Link>
          )}

          {!isAdmin && !isLive && joined && (
            <p className="text-center text-sm text-brand-muted">You&apos;re on the roster</p>
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
              Join
            </button>
          )}

          {expanded && !isAdmin && !isLive && spotsOpen && !joined && (
            <a
              href={competitionJoinUrl(row.id)}
              className="brand-btn block w-full py-2 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {userId ? 'Add yourself' : 'Sign up to join'}
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
              className="w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
            >
              Delete competition
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
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<ListTab>('current')
  const didDefaultTab = useRef(false)

  const { currentRows, pastRows } = useMemo(() => {
    const current: CompetitionRow[] = []
    const past: CompetitionRow[] = []
    for (const row of rows) {
      if (row.status === 'complete') past.push(row)
      else current.push(row)
    }
    past.sort((a, b) => {
      const ta = Date.parse(a.competition_started_at ?? a.starts_at ?? '')
      const tb = Date.parse(b.competition_started_at ?? b.starts_at ?? '')
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })
    return { currentRows: current, pastRows: past }
  }, [rows])

  const visibleRows = tab === 'past' ? pastRows : currentRows

  useEffect(() => {
    if (loading || didDefaultTab.current) return
    didDefaultTab.current = true
    if (currentRows.length === 0 && pastRows.length > 0) setTab('past')
  }, [loading, currentRows.length, pastRows.length])

  return (
    <div className="space-y-3">
      <ListTabs
        tab={tab}
        onTab={setTab}
        currentCount={currentRows.length}
        pastCount={pastRows.length}
      />

      {error && <p className="px-1 text-center text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="py-6 text-center text-xs text-brand-muted">Loading…</p>
      ) : visibleRows.length === 0 ? (
        <div className="game-card space-y-2 px-4 py-5 text-center">
          <p className="text-sm text-brand-text">
            {tab === 'past' ? 'No past games yet.' : 'No current games.'}
          </p>
          {tab === 'current' && isAdmin ? (
            <>
              <Link to="/competitions/new" className="brand-btn inline-block px-6 py-2">
                Add competition
              </Link>
              <p className="text-xs text-brand-muted">Or tap + in the corner.</p>
            </>
          ) : tab === 'current' ? (
            <p className="text-xs text-brand-muted">Check back when the organiser posts one.</p>
          ) : null}
        </div>
      ) : tab === 'current' ? (
        visibleRows.map((row) => (
          <CompetitionCurrentGameCard
            key={row.id}
            sessionId={row.id}
            title={row.title}
            isAdmin={isAdmin}
            onListRefresh={onRefresh}
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
          />
        ))
      )}
    </div>
  )
}
