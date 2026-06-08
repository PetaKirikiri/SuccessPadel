const COMPETITION_UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'

/** Public competition play or legacy guest join URL — hide generic Sign In here. */
export function isCompetitionPublicViewPath(pathname: string): boolean {
  return new RegExp(`^/competitions/${COMPETITION_UUID}(/join)?$`, 'i').test(pathname)
}
