export function isPlayerUuid(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

export function playerNameSlug(displayName: string | null | undefined): string | null {
  const slug = displayName
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || null
}

export function playerProfilePath(input: {
  id?: string | null
  displayName?: string | null
  suffix?: string
  competitionId?: string | null
}): string {
  const token = playerNameSlug(input.displayName) ?? input.id
  const params = input.competitionId ? `?competition=${encodeURIComponent(input.competitionId)}` : ''
  return `/players/${token ?? 'player'}${input.suffix ?? ''}${params}`
}
