import { competitionInviteTitle, competitionLevelLabel } from './competitionLevel.ts'
import { CLUB_TIMEZONE, formatClubTimeLocalized } from './courtSchedule.ts'
import { competitionScheduleFromSession, totalScheduleMinutes } from './competitionScheduleLayout.ts'
import type { GameSession } from './types'

export type ShareCompetition = Pick<GameSession,
  'id' | 'title' | 'starts_at' | 'ends_at' | 'starts_on' | 'skill_level' |
  'skill_level_min_rank' | 'skill_level_max_rank' | 'scoring_config' |
  'schedule_game_count' | 'schedule_game_minutes' | 'schedule_break_minutes'>

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

/** Public invite details only. No roster, account, or request-supplied text. */
export function competitionShareDetails(row: ShareCompetition) {
  const level = competitionLevelLabel(row)
  const name = competitionInviteTitle(row.title, level)
    .replace(/^superhero americano match\s*!*$/i, 'Superhero Americano')
  const start = validDate(row.starts_at)
  // A date-only competition must never shift to yesterday on a server in UTC.
  const date = start ?? validDate(row.starts_on ? `${row.starts_on}T12:00:00+07:00` : null)
  let end = validDate(row.ends_at)
  if (!end && start) {
    const schedule = competitionScheduleFromSession(row)
    end = new Date(start.getTime() + totalScheduleMinutes(schedule.games, schedule.gameMinutes, schedule.breakMinutes) * 60_000)
  }
  const dateText = date ? new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(date) : null
  const timeText = start ? `${formatClubTimeLocalized(start, 'en')}${end ? `–${formatClubTimeLocalized(end, 'en')}` : ''}` : null
  return {
    title: [name, level].filter(Boolean).join(' · '),
    description: [dateText, timeText, 'Success Padel Samui'].filter(Boolean).join(' · '),
    url: `https://successpadel.app/competitive?competition=${encodeURIComponent(row.id)}`,
  }
}
