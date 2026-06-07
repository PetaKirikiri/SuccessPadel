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

const META_PILL =
  'rounded-full border border-brand-border px-2 py-0.5 text-[10px] font-medium text-brand-muted'

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
        <div className="space-y-2.5 px-3 py-3">
          <div className="flex min-w-0 items-start gap-2 border-b border-brand-border/60 pb-2.5">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-display text-sm font-semibold leading-snug text-brand-primary">
                {row.title}
              </p>
              {scheduled && <p className="text-[11px] text-brand-muted">{scheduled}</p>}
            </div>
            <span className="shrink-0 pt-0.5 text-sm text-brand-muted">›</span>
          </div>

          {countdown && (
            <div className="flex items-baseline justify-between gap-2 border-b border-brand-border/60 pb-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                {countdown.label}
              </span>
              <span className="font-display text-base font-semibold tabular-nums text-brand-text">
                {countdown.value}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {badge && <span className={META_PILL}>{badge}</span>}
            {row.skill_level && <span className={META_PILL}>{row.skill_level}</span>}
            {row.gender && <span className={META_PILL}>{row.gender}</span>}
            <span className={META_PILL}>{spots}</span>
          </div>

          <p className="text-[11px] leading-relaxed text-brand-muted">{spiel}</p>
          {row.rules?.trim() && !spiel.includes(row.rules.trim()) && (
            <p className="text-[11px] leading-relaxed text-brand-muted">{row.rules.trim()}</p>
          )}
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
