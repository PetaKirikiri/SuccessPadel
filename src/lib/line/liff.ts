import liff from '@line/liff'

const liffId = (import.meta.env.VITE_LIFF_ID as string | undefined)?.trim() || undefined

let initPromise: Promise<void> | null = null

export function hasLiffId(): boolean {
  return Boolean(liffId)
}

export function isLineLiffBrowser(): boolean {
  return /Line\//i.test(navigator.userAgent) || document.referrer.includes('liff.line.me')
}

function canInitLiffOnThisPage(): boolean {
  return Boolean(liffId)
}

const PROFILE_RECONSENT_KEY = 'sp-liff-profile-reconsent'

export function clearLineProfileReconsentFlag(): void {
  sessionStorage.removeItem(PROFILE_RECONSENT_KEY)
}

export async function initLiff(): Promise<void> {
  if (!liffId || !canInitLiffOnThisPage()) return
  if (!initPromise) {
    initPromise = liff.init({ liffId })
  }
  await initPromise
}

export function isInLineClient(): boolean {
  try {
    return liff.isInClient()
  } catch {
    return false
  }
}

export async function detectInLineClient(): Promise<boolean> {
  if (!liffId) return false
  try {
    await initLiff()
    return liff.isInClient()
  } catch {
    return false
  }
}

export function isLineLoggedIn(): boolean {
  try {
    return liff.isLoggedIn()
  } catch {
    return false
  }
}

export async function getLineProfile() {
  await initLiff()
  if (!liff.isLoggedIn()) return null
  return liff.getProfile()
}

export async function getLineIdToken(): Promise<string | null> {
  await initLiff()
  if (!liff.isLoggedIn()) return null
  return liff.getIDToken()
}

export async function getLineAccessToken(): Promise<string | null> {
  await initLiff()
  if (!liff.isLoggedIn()) return null
  return liff.getAccessToken()
}

export function getDecodedLineClaims(): { sub?: string; name?: string; picture?: string } | null {
  try {
    const decoded = liff.getDecodedIDToken()
    if (!decoded) return null
    return {
      sub: decoded.sub,
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
      picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
    }
  } catch {
    return null
  }
}

export function lineLoginRedirect(): void {
  if (!liffId) return
  const path = window.location.pathname.startsWith('/') ? window.location.pathname : '/login'
  const redirectUri = `${window.location.origin}${path}${window.location.search}`
  liff.login({ redirectUri })
}

/** Re-prompt LINE Allow when profile scope was added after an old LIFF session. */
export async function ensureLineProfileConsent(): Promise<'ok' | 'redirected'> {
  await initLiff()
  if (!isLineLoggedIn()) return 'ok'

  try {
    const profile = await liff.getProfile()
    if (profile?.displayName?.trim()) {
      clearLineProfileReconsentFlag()
      return 'ok'
    }
  } catch {
    /* may still succeed via access token on server */
  }

  const decoded = getDecodedLineClaims()
  if (decoded?.name?.trim()) {
    clearLineProfileReconsentFlag()
    return 'ok'
  }

  return 'ok'
}

export function liffShareUrl(): string | null {
  if (!liffId) return null
  return `https://liff.line.me/${liffId}`
}

/** URL for QR / Open in LINE — always production LIFF (opens Vercel endpoint). */
export function lineAppEntryUrl(path = '/login'): string | null {
  if (!liffId) return null
  const normalized = path.startsWith('/') ? path : `/${path}`
  const suffix = normalized === '/' ? '' : normalized
  return `https://liff.line.me/${liffId}${suffix}`
}

export function isMobileWeb(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/** Open a URL in the device default browser (Safari / Chrome). */
export async function openLineExternalUrl(url: string): Promise<boolean> {
  try {
    if (liffId) {
      await initLiff()
      if (liff.isInClient() && liff.isApiAvailable('openWindow')) {
        liff.openWindow({ url, external: true })
        return true
      }
    }
  } catch {
    /* try fallbacks */
  }

  try {
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (opened) return true
  } catch {
    /* ignore */
  }

  window.location.assign(url)
  return !isLineLiffBrowser()
}

export async function shareLeaderboardUrl(title: string, url: string): Promise<void> {
  await initLiff()
  if (!liff.isApiAvailable('shareTargetPicker')) return
  await liff.shareTargetPicker([
    {
      type: 'text',
      text: `${title}\n${url}`,
    },
  ])
}
