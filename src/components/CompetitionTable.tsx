import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { formatClubDateShort, formatClubTime } from '../lib/courtSchedule'
import { canJoinGame, rosterLabel } from '../lib/playerCaps'
import { supabase } from '../lib/supabaseClient'
import { CompetitionGuestRoster } from './CompetitionGuestRoster'
import type { CompetitionRow } from '../hooks/useCompetitions'

type Props = {
  rows: CompetitionRow[]
  loading?: boolean
  error?: string | null
  isAdmin: boolean
  userId?: string
  onRefresh: () => void
}

function whenLabel(row: CompetitionRow): string {
  if (row.starts_at) {
    const start = new Date(row.starts_at)
    const end = row.ends_at ? new Date(row.ends_at) : null
    const date = formatClubDateShort(start)
    const time = end
      ? `${formatClubTime(start)}–${formatClubTime(end)}`
      : formatClubTime(start)
    return `${date} · ${time}`
  }
  return row.starts_on ?? '—'
}

function CompetitionCard({
  row,
  userId,
  isAdmin,
  expanded,
  onToggle,
  onRefresh,
}: {
  row: CompetitionRow
  userId?: string
  isAdmin: boolean
  expanded: boolean
  onToggle: () => void
  onRefresh: () => void
}) {
  const loc = useLocation()
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const isLive = Boolean(row.competition_started_at)
  const roster = row.session_players ?? []
  const rosterCount = roster.length
  const target = row.target_players ?? row.max_players ?? null
  const joined = userId ? roster.some((sp) => sp.profile_id === userId) : false
  const spotsOpen = canJoinGame(row, rosterCount) && row.status === 'open'
  const canJoin = !joined && userId && spotsOpen
  const needsSignIn = !joined && !userId && spotsOpen

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

  return (
    <article className="game-card overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full min-w-0 items-start gap-2 px-3 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-medium leading-snug text-brand-primary">{row.title}</p>
          <p className="text-xs text-brand-muted">{whenLabel(row)}</p>
          <div className="flex flex-wrap gap-1.5">
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
        <span className="shrink-0 pt-0.5 text-[10px] text-brand-muted">{expanded ? '▲' : '▼'}</span>
      </button>

      {isLive && (
        <div className="border-t border-brand-border/50 px-3 py-2">
          <Link
            to={`/competitions/${row.id}/run`}
            className="brand-btn block w-full py-2 text-center text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            Live
          </Link>
        </div>
      )}

      {expanded && (
        <div className="space-y-3 border-t border-brand-border/50 px-3 py-3">
          {row.rules && <p className="text-sm leading-relaxed text-brand-text">{row.rules}</p>}

          <div onClick={(e) => e.stopPropagation()}>
            <CompetitionGuestRoster
              sessionId={row.id}
              session={row}
              roster={roster}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
            />
          </div>

          {canJoin && (
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

          {needsSignIn && (
            <Link
              to="/login"
              state={{ from: loc.pathname }}
              className="brand-btn block w-full py-2 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              Sign in to join
            </Link>
          )}

          {isAdmin && row.status === 'open' && !row.competition_started_at && rosterCount >= 4 && (
            <Link
              to={`/competitions/${row.id}/run`}
              className="brand-btn block w-full py-2 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              Start
            </Link>
          )}

          {isLive && (
            <p className="text-xs text-brand-muted">
              Share the link — players sign in with the email you added for them.
            </p>
          )}

          {joinError && <p className="text-xs text-red-600">{joinError}</p>}
        </div>
      )}
    </article>
  )
}

export function CompetitionTable({ rows, loading, error, isAdmin, userId, onRefresh }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {isAdmin && (
        <div className="flex justify-end px-1">
          <Link to="/competitions/new" className="text-[11px] font-medium text-brand-accent">
            Add
          </Link>
        </div>
      )}

      {error && <p className="px-1 text-center text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="py-6 text-center text-xs text-brand-muted">…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-brand-muted">—</p>
      ) : (
        rows.map((row) => (
          <CompetitionCard
            key={row.id}
            row={row}
            userId={userId}
            isAdmin={isAdmin}
            expanded={expandedId === row.id}
            onToggle={() => setExpandedId((id) => (id === row.id ? null : row.id))}
            onRefresh={onRefresh}
          />
        ))
      )}
    </div>
  )
}
