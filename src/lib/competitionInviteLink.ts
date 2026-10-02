/** Permanent event identity, independent of its editable date, level or title. */
export function competitionInvitePath(id: string): string {
  return `/competitive?competition=${encodeURIComponent(id)}`
}

export function competitionInviteUrl(id: string): string {
  // The server resolves this prefix only when it identifies exactly one event.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return `https://successpadel.app/c/${id.slice(0, 8).toLowerCase()}`
  }
  return `https://successpadel.app${competitionInvitePath(id)}`
}

/** A supplied code must never fall back to a different competition. */
export function selectInvitedCompetition<T extends { id: string }>(rows: T[], id: string): T[] {
  return rows.filter(row => row.id.toLowerCase() === id.toLowerCase())
}
