import type { CompetitionRow } from '../hooks/useCompetitions'
import { formatClubDateShort, formatClubTime } from './courtSchedule'
import {
  courtsNeeded,
  gameSlotOptsFromSchedule,
  gameSlotTimes,
  resolveCompetitionSchedule,
} from './competitionLayout'
import {
  americanoScoreTarget,
  americanoScoringUnit,
  usesAmericanoScoring,
} from './competitionPresets'
import type { GameSession } from './types'

export type CompetitionCardPhase = 'upcoming' | 'live' | 'break' | 'finished' | 'unscheduled'

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function competitionScheduledLabel(
  row: Pick<GameSession, 'starts_at' | 'ends_at' | 'scoring_config' | 'target_players' | 'max_players'> & {
    session_pairs?: unknown[]
  },
): string | null {
  const resolved = resolveCompetitionSchedule(row)
  if (!resolved.playStartsAt) return null
  const start = resolved.playStartsAt
  const date = formatClubDateShort(start)
  const from = formatClubTime(start)
  const to = resolved.eventEndsAt ? formatClubTime(resolved.eventEndsAt) : null
  return to ? `${date} · ${from}–${to}` : `${date} · ${from}`
}

type CompetitionScheduleRow = Pick<
  GameSession,
  'starts_at' | 'ends_at' | 'status' | 'scoring_config' | 'target_players' | 'max_players'
> & { session_pairs?: unknown[] }

/** Listed under Past when complete or the scheduled window has ended. */
export function competitionIsPast(row: CompetitionScheduleRow, now: number = Date.now()): boolean {
  return competitionCardPhase(row, now) === 'finished'
}

export function competitionCardPhase(row: CompetitionScheduleRow, now: number): CompetitionCardPhase {
  if (row.status === 'complete') return 'finished'
  const startMs = row.starts_at ? Date.parse(row.starts_at) : NaN
  const endMs = row.ends_at ? Date.parse(row.ends_at) : NaN
  if (!Number.isFinite(startMs)) return 'unscheduled'
  if (now >= endMs) return 'finished'
  if (now < startMs) return 'upcoming'

  const schedule = resolveCompetitionSchedule(row)
  const slotOpts = gameSlotOptsFromSchedule(schedule)
  for (let g = 1; g <= schedule.totalGames; g += 1) {
    const slot = gameSlotTimes(row.starts_at!, g, schedule.gameMinutes, schedule.breakMinutes, slotOpts)
    const slotStart = slot.startsAt.getTime()
    const slotEnd = slot.endsAt.getTime()
    if (now >= slotStart && now < slotEnd) return 'live'
    if (g < schedule.totalGames) {
      const next = gameSlotTimes(row.starts_at!, g + 1, schedule.gameMinutes, schedule.breakMinutes, slotOpts)
      if (now >= slotEnd && now < next.startsAt.getTime()) return 'break'
    }
  }
  if (now >= startMs && now < endMs) return 'break'
  return 'finished'
}

export function competitionCountdown(row: CompetitionScheduleRow, now: number): { label: string; value: string } | null {
  const phase = competitionCardPhase(row, now)
  const startMs = row.starts_at ? Date.parse(row.starts_at) : NaN
  const endMs = row.ends_at ? Date.parse(row.ends_at) : NaN

  if (phase === 'upcoming' && Number.isFinite(startMs)) {
    return { label: 'Starts in', value: formatCountdown(startMs - now) }
  }
  if (phase === 'finished') return null
  if (!Number.isFinite(startMs) || !row.starts_at) return null

  const schedule = resolveCompetitionSchedule(row)
  const slotOpts = gameSlotOptsFromSchedule(schedule)
  for (let g = 1; g <= schedule.totalGames; g += 1) {
    const slot = gameSlotTimes(row.starts_at, g, schedule.gameMinutes, schedule.breakMinutes, slotOpts)
    const slotStart = slot.startsAt.getTime()
    const slotEnd = slot.endsAt.getTime()
    if (now >= slotStart && now < slotEnd) {
      return { label: `Game ${g} · ${schedule.gameMinutes} min`, value: formatCountdown(slotEnd - now) }
    }
    if (g < schedule.totalGames) {
      const next = gameSlotTimes(row.starts_at, g + 1, schedule.gameMinutes, schedule.breakMinutes, slotOpts)
      if (now >= slotEnd && now < next.startsAt.getTime()) {
        return { label: 'Break', value: formatCountdown(next.startsAt.getTime() - now) }
      }
    }
  }
  if (Number.isFinite(endMs) && now < endMs) {
    return { label: 'Event ends in', value: formatCountdown(endMs - now) }
  }
  return null
}

export function competitionLayoutSpiel(row: CompetitionRow): string {
  const rosterCount = row.session_players?.length ?? 0
  const courts = courtsNeeded(rosterCount)
  const schedule = resolveCompetitionSchedule(row)
  const parts: string[] = []

  if (usesAmericanoScoring(row)) {
    const unit = americanoScoringUnit(row)
    const target = americanoScoreTarget(row)
    const score =
      unit === 'open'
        ? 'open'
        : unit === 'games'
          ? `${target ?? 6} games`
          : unit === 'sets'
            ? `${target ?? 4} sets`
            : `${target ?? 24} pts`
    parts.push(`Americano · ${score}`)
  } else if (row.rules) {
    parts.push(row.rules.split('\n')[0] ?? row.rules)
  } else {
    parts.push('King of Court')
  }

  if (courts > 0) parts.push(`${courts} court${courts === 1 ? '' : 's'}`)
  if (rosterCount > 0) parts.push(`${rosterCount} players`)
  parts.push(`${schedule.totalGames} games · ${schedule.gameMinutes} min + ${schedule.breakMinutes} min break`)

  return parts.join(' · ')
}

export function competitionPhaseBadge(phase: CompetitionCardPhase): string | null {
  if (phase === 'live') return 'Live'
  if (phase === 'break') return 'Break'
  if (phase === 'upcoming') return 'Upcoming'
  if (phase === 'unscheduled') return 'Scheduled'
  return null
}

export function competitionIsLiveByTime(row: CompetitionScheduleRow, now: number): boolean {
  return competitionCardPhase(row, now) === 'live'
}
