import { useMemo } from 'react'
import { courtsNeeded, planAmericanoSchedule } from '../lib/competitionLayout'

function formatBangkokTime(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  }).format(d)
}

type Props = {
  startsAtIso: string
  eventMinutes: number
  gameCount: number
  gameMinutes: number
  breakMinutes: number
  playerCount: number
}

export function CompetitionSchedulePreview({
  startsAtIso,
  eventMinutes,
  gameCount,
  gameMinutes,
  breakMinutes,
  playerCount,
}: Props) {
  const plan = useMemo(
    () => planAmericanoSchedule(startsAtIso, gameCount, gameMinutes, breakMinutes, eventMinutes),
    [startsAtIso, eventMinutes, gameCount, gameMinutes, breakMinutes],
  )
  const courtCount = courtsNeeded(playerCount)

  return (
    <div className="rounded-lg border border-brand-border/60 bg-brand-bg-alt/40 p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        Schedule preview
      </p>
      <p className="text-xs text-brand-text">
        {courtCount} court{courtCount === 1 ? '' : 's'} · {playerCount} players
      </p>
      <ul className="space-y-1 text-xs text-brand-muted">
        {plan.slots.map((slot) => (
          <li key={slot.gameNumber} className="flex justify-between gap-2 tabular-nums">
            <span className="text-brand-text">Game {slot.gameNumber}</span>
            <span>
              {formatBangkokTime(slot.startsAt)} – {formatBangkokTime(slot.endsAt)}
              {slot.breakMinutesAfter > 0 ? ` (+${slot.breakMinutesAfter}m)` : ''}
            </span>
          </li>
        ))}
      </ul>
      {plan.finishAt && (
        <p className="text-xs font-medium text-brand-primary">
          Finish {formatBangkokTime(plan.finishAt)}
          {plan.fits
            ? ` · ${plan.bufferMinutes} min spare`
            : ` · ${plan.usedMinutes - eventMinutes} min over`}
        </p>
      )}
      {!plan.fits && (
        <p className="text-xs text-red-600">
          Schedule exceeds your session — shorten games, rest, or game count, or add time.
        </p>
      )}
    </div>
  )
}
