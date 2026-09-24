/** Public, player-specific review links must never point at a local development server. */
export function competitionReviewUrl(competitionId: string, rosterPlayerId: string): string {
  const url = new URL('/competitive', 'https://successpadel.app')
  url.searchParams.set('competition', competitionId)
  url.searchParams.set('view', 'review')
  url.searchParams.set('player', rosterPlayerId)
  return url.toString()
}
