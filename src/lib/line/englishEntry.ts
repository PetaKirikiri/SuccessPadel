// The registered LINE endpoint stays unchanged. Only this explicitly marked
// entry belongs to EnglishSuccess; player QR claims and Padel links are untouched.
export const ENGLISH_HOTEL = 'https://learn-english-coral.vercel.app/hotel'
export const SHARED_LIFF_ID = '2010311582-o2c1DCnP'
export const LINE_ENDPOINT = 'https://successpadel.app/login'
export type EnglishMode = 'hotel' | 'english' | 'padel' | 'padel-coach'
const destinations: Record<EnglishMode, string> = {
  hotel: ENGLISH_HOTEL,
  english: 'https://learn-english-coral.vercel.app/english',
  padel: 'https://learn-english-coral.vercel.app/padel',
  'padel-coach': 'https://learn-english-coral.vercel.app/padel-coach',
}
export const englishDestination = (mode: EnglishMode = 'hotel') => destinations[mode] ?? ENGLISH_HOTEL

export function englishEntry(search: string): { signup: boolean; attempted: boolean; mode?: EnglishMode } | null {
  const direct = new URLSearchParams(search)
  let nested = new URLSearchParams()
  try { nested = new URL(direct.get('liff.state') ?? '', LINE_ENDPOINT).searchParams } catch { /* invalid state */ }
  if ([direct, nested].some(params => params.has('lpl') || params.has('sp_return_to'))) return null
  const params = [direct, nested].find(item => item.get('app') === 'englishsuccess' && ['hotel','english','padel','padel-coach'].includes(item.get('mode') ?? ''))
  return params ? { signup: params.get('intent') === 'signup', attempted: params.get('english_attempt') === '1', ...(params.get('mode') !== 'hotel' ? { mode: params.get('mode') as EnglishMode } : {}) } : null
}

export function englishLoginCallback(signup: boolean, mode: EnglishMode = 'hotel') {
  const url = new URL(LINE_ENDPOINT)
  url.search = new URLSearchParams({ app: 'englishsuccess', mode, english_attempt: '1' }).toString()
  if (signup) url.searchParams.set('intent', 'signup')
  return url.href
}

export function englishTicketUrl(ticket: string, mode: EnglishMode = 'hotel') {
  const url = new URL(englishDestination(mode))
  url.hash = new URLSearchParams({ ticket }).toString()
  return url.href
}
