export type HomepageCompetition = {
  id: string
  status: string
  starts_at?: string | null
  ends_at?: string | null
  starts_on?: string | null
  ends_on?: string | null
}

/** Select once on arrival; stale locked events must not outrank today's event. */
export function nearestCompetitionId(rows: HomepageCompetition[], now = Date.now()): string | null {
  const dated = rows
    .filter(row => ['open', 'locked', 'complete'].includes(row.status))
    .map(row => ({
      row,
      start: Date.parse(row.starts_at || (row.starts_on ? `${row.starts_on}T00:00:00+07:00` : '')),
      end: Date.parse(row.ends_at || (row.ends_on || row.starts_on ? `${row.ends_on || row.starts_on}T23:59:59.999+07:00` : '')),
    }))
    .filter(item => Number.isFinite(item.start))
    .sort((a, b) => a.start - b.start || a.row.id.localeCompare(b.row.id))

  const current = dated.filter(item => item.row.status !== 'complete' && item.start <= now && item.end > now)
  if (current.length) return current[current.length - 1].row.id
  const upcoming = dated.find(item => item.row.status !== 'complete' && item.start > now)
  if (upcoming) return upcoming.row.id
  const previous = dated.filter(item => item.start <= now)
  return previous.at(-1)?.row.id ?? null
}
