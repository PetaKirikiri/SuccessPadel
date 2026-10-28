// Account-link handoffs cross browser origins. Never derive this destination
// from the LIFF endpoint, a Vercel preview, localhost, or VITE_SITE_URL.
export const PLAYER_LINK_APP_ORIGIN = 'https://successpadel.app'

export function lineHandoffCompleteUrl(handoffToken: string, linkToken?: string | null, competitionId?: string | null): string {
  const params = new URLSearchParams({ handoffToken })
  if (linkToken?.startsWith('lpl_')) params.set('lpl', linkToken)
  if (competitionId) params.set('cid', competitionId)
  return `${PLAYER_LINK_APP_ORIGIN}/auth/line/complete?${params}`
}
