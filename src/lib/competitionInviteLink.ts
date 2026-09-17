/** Permanent event identity, independent of its editable date, level or title. */
export function competitionInvitePath(id: string): string {
  return `/competitive?competition=${encodeURIComponent(id)}`
}

export function competitionInviteUrl(id: string): string {
  // Public aliases are permanent and must match vercel.json redirects.
  if (id.toLowerCase() === '9df4f70a-2532-4f11-9a6d-013ab7110c25') {
    return 'https://successpadel.app/c/17sep26'
  }
  return `https://successpadel.app${competitionInvitePath(id)}`
}

/** A supplied code must never fall back to a different competition. */
export function selectInvitedCompetition<T extends { id: string }>(rows: T[], id: string): T[] {
  return rows.filter(row => row.id.toLowerCase() === id.toLowerCase())
}
