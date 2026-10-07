/** The frozen draw uses Bangkok wall-clock times, independent of the viewer's timezone. */
export function rainCountdown(date: string, start: string, end: string, now: number, nextStart?: string) {
  const startsAt = Date.parse(`${date}T${start.length === 5 ? start + ":00" : start}+07:00`)
  const endsAt = Date.parse(`${date}T${end.length === 5 ? end + ":00" : end}+07:00`)
  const nextAt = nextStart ? Date.parse(`${date}T${nextStart.length === 5 ? nextStart + ":00" : nextStart}+07:00`) : 0
  const inBreak = now >= endsAt && now < nextAt
  const live = now >= startsAt && now < endsAt
  const remaining = Math.max(0, (now < startsAt ? startsAt : inBreak ? nextAt : endsAt) - now)
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor(remaining % 60000 / 1000)
  return {
    live,
    value: `${minutes}:${String(seconds).padStart(2, '0')}`,
    label: now < startsAt ? 'Game starts in' : live ? 'Game finishes in' : inBreak ? 'Break time' : 'Finished',
  }
}
