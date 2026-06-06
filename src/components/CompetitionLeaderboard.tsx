import type { AmericanoScoringUnit } from '../lib/competitionPresets'

export type LeaderboardEntry = {
  profile_id: string
  display_name: string
  total_points: number
  games: number
}

type Props = {
  entries: LeaderboardEntry[]
  compact?: boolean
  scoreUnit?: AmericanoScoringUnit
}

export function CompetitionLeaderboard({ entries, compact = false, scoreUnit = 'points' }: Props) {
  const unit = scoreUnit === 'sets' ? 'sets' : 'pts'
  if (entries.length === 0) return null

  const winner = entries[0]

  return (
    <div className="game-card px-3 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {compact ? 'Standings' : 'Americano standings'}
      </p>
      <ol className="m-0 list-none space-y-1 p-0">
        {entries.map((e, i) => (
          <li key={e.profile_id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-brand-text">
              <span className="mr-1.5 text-xs text-brand-muted">{i + 1}.</span>
              {e.display_name}
            </span>
            <span className="font-medium text-brand-accent">
              {e.total_points} {unit}
            </span>
          </li>
        ))}
      </ol>
      {!compact && winner && (
        <p className="mt-2 text-center text-xs text-brand-muted">
          Leader: {winner.display_name} ({winner.total_points} {unit})
        </p>
      )}
    </div>
  )
}
