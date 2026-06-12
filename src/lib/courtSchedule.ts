export const CLUB_TIMEZONE = 'Asia/Bangkok'
export const OPEN_HOUR = 6
export const CLOSE_HOUR = 22
export const LAST_SLOT_START_HOUR = 21
export const PLAYERS_PER_COURT = 4

export type HourBlock = {
  index: number
  startsAt: Date
  endsAt: Date
  label: string
}

export function formatDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseClubDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`)
}

export function clubHourToDate(dateStr: string, hour: number, minute = 0): Date {
  const d = parseClubDate(dateStr)
  d.setHours(hour, minute, 0, 0)
  return d
}

export function formatClubTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatClubDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function buildHourBlocks(start: Date, hours: number): HourBlock[] {
  return Array.from({ length: hours }, (_, i) => {
    const startsAt = new Date(start.getTime() + i * 60 * 60 * 1000)
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)
    return {
      index: i,
      startsAt,
      endsAt,
      label: `${formatClubTime(startsAt)} – ${formatClubTime(endsAt)}`,
    }
  })
}

export function availableStartHours(_dateStr?: string): number[] {
  const hours: number[] = []
  for (let h = OPEN_HOUR; h <= LAST_SLOT_START_HOUR; h++) hours.push(h)
  return hours
}

export function maxDurationFromStart(startHour: number): number {
  return Math.max(0, CLOSE_HOUR - startHour)
}

export function maxConsecutiveHours(startHour: number, availableHours: number[]): number {
  const set = new Set(availableHours)
  let count = 0
  while (set.has(startHour + count) && startHour + count < CLOSE_HOUR) count++
  return Math.max(count, 1)
}

export function formatHourLabel(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** Five-minute steps for delayed session start (e.g. 18:30). */
export const SESSION_START_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const

export function roundToSessionStartMinute(minute: number): number {
  const step = 5
  return Math.min(55, Math.max(0, Math.round(minute / step) * step))
}

export function scheduleGridHours(): number[] {
  const hours: number[] = []
  for (let h = OPEN_HOUR; h <= LAST_SLOT_START_HOUR; h++) hours.push(h)
  return hours
}

export type ClubHalfHourSlot = {
  hour: number
  minute: 0 | 30
  label: string
}

/** Club open hours at :00 and :30 (last start is on the hour). */
export function scheduleHalfHourSlots(): ClubHalfHourSlot[] {
  const slots: ClubHalfHourSlot[] = []
  for (let h = OPEN_HOUR; h <= LAST_SLOT_START_HOUR; h++) {
    slots.push({ hour: h, minute: 0, label: formatHourLabel(h, 0) })
    if (h < LAST_SLOT_START_HOUR) {
      slots.push({ hour: h, minute: 30, label: formatHourLabel(h, 30) })
    }
  }
  return slots
}

export function clubTimeSlotValue(hour: number, minute: number): string {
  return formatHourLabel(hour, minute)
}

export function parseClubTimeSlotValue(value: string): { hour: number; minute: number } {
  const [hRaw, mRaw] = value.split(':')
  const hour = Number(hRaw)
  const minute = Number(mRaw)
  return {
    hour: Number.isFinite(hour) ? hour : 18,
    minute: minute === 30 ? 30 : 0,
  }
}

export function snapToHalfHour(hour: number, minute: number): { hour: number; minute: 0 | 30 } {
  if (minute < 15) return { hour, minute: 0 }
  if (minute < 45) return { hour, minute: 30 }
  return { hour: hour + 1, minute: 0 }
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function toIsoTimestamp(dateStr: string, hour: number, minute = 0): string {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${dateStr}T${hh}:${mm}:00+07:00`
}

export function bangkokHour(iso: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: CLUB_TIMEZONE,
    }).format(new Date(iso)),
    10,
  )
}

export function clubTimePartsFromDate(d: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
  }
}

export function bangkokNow(): { day: string; hour: number; minute: number } {
  const now = new Date()
  return {
    day: new Intl.DateTimeFormat('en-CA', { timeZone: CLUB_TIMEZONE }).format(now),
    hour: clubTimePartsFromDate(now).hour,
    minute: clubTimePartsFromDate(now).minute,
  }
}
