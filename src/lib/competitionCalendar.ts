import { clubTodayDateInput } from './courtSchedule'

export function clubCompetitionDay(startsAt: string | null): string | null {
  if (!startsAt || !Number.isFinite(Date.parse(startsAt))) return null
  return clubTodayDateInput(new Date(startsAt))
}

/** Calendar arithmetic uses UTC date-only values, independent of a visitor's timezone. */
export function shiftCalendarDay(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function competitionWeekDays(day: string): string[] {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  const monday = shiftCalendarDay(day, -((weekday + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => shiftCalendarDay(monday, index))
}
