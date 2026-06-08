const COMPETITION_UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'

const COMPETITION_PUBLIC_PATH = new RegExp(
  `^/competitions/(${COMPETITION_UUID})(?:/join)?$`,
  'i',
)

/** Public competition play or legacy guest join URL — hide generic Sign In here. */
export function isCompetitionPublicViewPath(pathname: string): boolean {
  return COMPETITION_PUBLIC_PATH.test(pathname)
}

export function competitionIdFromPublicPath(pathname: string): string | null {
  return pathname.match(COMPETITION_PUBLIC_PATH)?.[1] ?? null
}
