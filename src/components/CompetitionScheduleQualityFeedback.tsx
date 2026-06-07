import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { rosterDisplayName } from '../hooks/useCompetitions'
import {
  listScheduleRepeats,
  type RoundAssignment,
  type ScheduleQuality,
} from '../lib/balancedSchedule'

type Props = {
  rounds: RoundAssignment[]
  roster: CompetitionPlayer[]
  quality: ScheduleQuality
}

function playerLabel(roster: CompetitionPlayer[], slot: number): string {
  const player = roster[slot]
  return player ? rosterDisplayName(player) : `Player ${slot + 1}`
}

function RepeatList({
  title,
  pairs,
  roster,
  verb,
}: {
  title: string
  pairs: { slotA: number; slotB: number; times: number }[]
  roster: CompetitionPlayer[]
  verb: string
}) {
  if (pairs.length === 0) {
    return (
      <p className="text-xs text-green-700 dark:text-green-400">
        ✓ {title}
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
        {title} ({pairs.length})
      </p>
      <ul className="space-y-0.5 text-[11px] text-brand-muted">
        {pairs.map((pair) => (
          <li key={`${pair.slotA}-${pair.slotB}`}>
            {playerLabel(roster, pair.slotA)} & {playerLabel(roster, pair.slotB)} — {verb}{' '}
            {pair.times}×
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CompetitionScheduleQualityFeedback({ rounds, roster, quality }: Props) {
  const { partners, opponents } = listScheduleRepeats(rounds)
  const badOpponents = opponents.filter((pair) => pair.times > 2)

  return (
    <div className="space-y-2 rounded-lg border border-brand-border/50 bg-brand-surface/60 px-3 py-2">
      <p className="text-xs font-semibold text-brand-primary">Schedule check</p>
      <RepeatList
        title="No repeat teammates"
        pairs={partners}
        roster={roster}
        verb="together"
      />
      <RepeatList
        title={
          badOpponents.length === 0
            ? `Opponents spread (max ${quality.maxOpponentMeetings}×)`
            : 'Repeat opponents'
        }
        pairs={badOpponents}
        roster={roster}
        verb="against"
      />
      {badOpponents.length === 0 && opponents.length > 0 && (
        <p className="text-[10px] text-brand-muted">
          {opponents.length} pair{opponents.length === 1 ? '' : 's'} meet twice — expected for{' '}
          {quality.playerCount} players over {quality.rounds} games.
        </p>
      )}
      {quality.repeatExactMatches > 0 ? (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          {quality.repeatExactMatches} identical match{quality.repeatExactMatches === 1 ? '' : 'es'}{' '}
          replayed
        </p>
      ) : (
        <p className="text-xs text-green-700 dark:text-green-400">✓ No identical match replays</p>
      )}
      <p className="text-[10px] text-brand-muted">
        Court balance gap: {quality.maxBalanceDiff} rank{quality.maxBalanceDiff === 1 ? '' : 's'}{' '}
        (lower is fairer)
      </p>
    </div>
  )
}
