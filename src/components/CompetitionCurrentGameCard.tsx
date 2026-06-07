import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CompetitionRow } from '../hooks/useCompetitions'
import {
  competitionCardPhase,
  competitionCountdown,
  competitionIsLiveByTime,
  competitionLayoutSpiel,
  competitionPhaseBadge,
  competitionScheduledLabel,
} from '../lib/competitionListCard'
import { rosterLabel } from '../lib/playerCaps'
import { supabase } from '../lib/supabaseClient'

type Props = {
  row: CompetitionRow
  isAdmin?: boolean
  onRefresh?: () => void
}

export function CompetitionCurrentGameCard({ row, isAdmin = false, onRefresh }: Props) {
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const phase = useMemo(() => competitionCardPhase(row, now), [row, now])
  const countdown = useMemo(() => competitionCountdown(row, now), [row, now])
  const scheduled = useMemo(() => competitionScheduledLabel(row), [row])
  const spiel = useMemo(() => competitionLayoutSpiel(row), [row])
  const badge = competitionPhaseBadge(phase)
  const isLive = competitionIsLiveByTime(row, now)

  const rosterCount = row.session_players?.length ?? 0
  const target = row.target_players ?? row.max_players ?? null
  const spots =
    target != null
      ? rosterLabel(rosterCount, target, row.player_cap_mode === 'flexible')
      : String(rosterCount)

  const metaParts = [badge, row.skill_level, row.gender, spots].filter(Boolean)

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
    else onRefresh?.()
  }

  return (
    <article className="game-card overflow-hidden p-0">
      <Link
        to={`/competitions/${row.id}`}
        className="block transition-opacity active:opacity-80"
      >
        <div className="px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold leading-snug text-brand-primary">
                {row.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-brand-muted">
                {[scheduled, metaParts.join(' · ')].filter(Boolean).join(' · ')}
              </p>
              {countdown && (
                <p className="mt-0.5 text-[11px] tabular-nums text-brand-muted">
                  {countdown.label} {countdown.value}
                </p>
              )}
              <p className="mt-1 text-[11px] leading-snug text-brand-muted">{spiel}</p>
            </div>
            <span className="shrink-0 text-sm text-brand-muted">›</span>
          </div>
        </div>
      </Link>

      {isAdmin ? (
        <div className="flex gap-2 border-t border-brand-border/60 px-3 py-2.5">
          <Link
            to={`/competitions/${row.id}/edit`}
            className="brand-btn-outline flex-1 py-2 text-center text-sm"
          >
            Edit
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="flex-1 rounded-xl border border-brand-border py-2 text-sm font-medium text-brand-muted disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ) : null}

      {deleteError && <p className="px-3 pb-2 text-xs text-red-600">{deleteError}</p>}
    </article>
  )
}
