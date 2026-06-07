import { Link } from 'react-router-dom'
import type { CompetitionRow } from '../hooks/useCompetitions'
import { rosterLabel } from '../lib/playerCaps'

type Props = {
  row: CompetitionRow
}

export function CompetitionCurrentGameCard({ row }: Props) {
  const isLive = Boolean(row.competition_started_at) && row.status !== 'complete'
  const rosterCount = row.session_players?.length ?? 0
  const target = row.target_players ?? row.max_players ?? null
  const spots =
    target != null
      ? rosterLabel(rosterCount, target, row.player_cap_mode === 'flexible')
      : String(rosterCount)

  return (
    <Link
      to={`/competitions/${row.id}`}
      className="game-card block overflow-hidden p-0 transition-opacity active:opacity-80"
    >
      <div className="flex w-full min-w-0 items-start gap-2 px-3 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-sm font-semibold leading-snug text-brand-primary">
            {row.title}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {isLive && (
              <span className="rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                Live
              </span>
            )}
            {!isLive && row.status === 'open' && (
              <span className="rounded-full border border-brand-border px-2 py-0.5 text-[10px] font-medium text-brand-muted">
                Upcoming
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
        <span className="shrink-0 pt-0.5 text-lg leading-none text-brand-muted">›</span>
      </div>
    </Link>
  )
}
