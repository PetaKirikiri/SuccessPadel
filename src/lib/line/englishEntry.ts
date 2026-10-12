// The registered LINE endpoint stays unchanged. Only this explicitly marked
// entry belongs to EnglishSuccess; player QR claims and Padel links are untouched.
export const ENGLISH_HOTEL = 'https://learn-english-coral.vercel.app/hotel'
export const SHARED_LIFF_ID = '2010311582-o2c1DCnP'
export const LINE_ENDPOINT = 'https://success-padel-ffzt.vercel.app/login'

export function englishEntry(search: string): { signup: boolean; attempted: boolean } | null {
  const direct = new URLSearchParams(search)
  let nested = new URLSearchParams()
  try { nested = new URL(direct.get('liff.state') ?? '', LINE_ENDPOINT).searchParams } catch { /* invalid state */ }
  if ([direct, nested].some(params => params.has('lpl') || params.has('sp_return_to'))) return null
  const params = [direct, nested].find(item => item.get('app') === 'englishsuccess' && item.get('mode') === 'hotel')
  return params ? { signup: params.get('intent') === 'signup', attempted: params.get('english_attempt') === '1' } : null
}

export function englishLoginCallback(signup: boolean) {
  const url = new URL(LINE_ENDPOINT)
  url.search = new URLSearchParams({ app: 'englishsuccess', mode: 'hotel', english_attempt: '1' }).toString()
  if (signup) url.searchParams.set('intent', 'signup')
  return url.href
}

export function englishTicketUrl(ticket: string) {
  const url = new URL(ENGLISH_HOTEL)
  url.hash = new URLSearchParams({ ticket }).toString()
  return url.href
}
