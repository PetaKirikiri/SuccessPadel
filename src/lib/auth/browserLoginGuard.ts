import { loginWithAppDebugLog, loginWithAppUrlSnapshot } from '../debug/loginWithAppDebug'

const BLOCKED_HOSTS = ['access.line.me', 'account.line.biz']

/** Throw with debug payload — no soft fallback (testing mode). */
export function loginWithAppFatal(
  code: string,
  hypothesisId: string,
  data: Record<string, unknown> = {},
): never {
  const payload = { code, ...data, url: loginWithAppUrlSnapshot(), ua: navigator.userAgent }
  // #region agent log
  loginWithAppDebugLog('browserLoginGuard:fatal', code, hypothesisId, payload)
  // #endregion
  throw new Error(`[LoginWithAPP:${code}] ${JSON.stringify(payload)}`)
}

function isBlockedLoginUrl(url: string): boolean {
  try {
    const host = new URL(url, window.location.href).hostname
    return BLOCKED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return url.includes('access.line.me')
  }
}

/** Block browser LINE login URLs. Safari makes location.assign read-only — no monkey-patching. */
export function installBrowserLoginBlocker(): void {
  if (typeof window === 'undefined') return
  const host = window.location.hostname
  if (BLOCKED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    loginWithAppFatal('on-access-line-me', 'H16', { host })
  }

  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement).closest('a')
      if (!a?.href || !isBlockedLoginUrl(a.href)) return
      e.preventDefault()
      loginWithAppFatal('blocked-anchor', 'H16', { href: a.href.slice(0, 120) })
    },
    true,
  )

  const nav = (window as Window & { navigation?: { addEventListener: Function } }).navigation
  if (nav?.addEventListener) {
    nav.addEventListener('navigate', (e: { destination?: { url?: string }; preventDefault?: () => void }) => {
      const url = e.destination?.url
      if (!url || !isBlockedLoginUrl(url)) return
      e.preventDefault?.()
      loginWithAppFatal('blocked-navigation', 'H16', { via: 'navigation-api', target: url.slice(0, 120) })
    })
  }
}

/** Browser OAuth callbacks are not member login — strip params and show LINE-only UI. */
export function rejectBrowserOAuthCallback(): string | null {
  const p = new URLSearchParams(window.location.search)
  if (!p.has('code') && !p.get('error')) return null
  // #region agent log
  loginWithAppDebugLog('browserLoginGuard:rejectOAuth', 'browser oauth callback rejected', 'H16', {
    hasCode: p.has('code'),
    error: p.get('error'),
  })
  // #endregion
  try {
    const u = new URL(window.location.href)
    u.search = ''
    window.history.replaceState({}, '', `${u.pathname}${u.hash}`)
  } catch {
    /* ignore */
  }
  return 'Browser sign-in is not supported. Open the link from inside the LINE app.'
}

export function fatalIfLiffBrowserFallback(referrer: string, hadTap: boolean): void {
  if (!referrer.includes('liff.line.me') && !hadTap) return
  loginWithAppFatal('liff-web-fallback', 'H12', {
    referrer: referrer.slice(0, 120),
    hadTap,
    platform: /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? 'ios'
      : /Android/i.test(navigator.userAgent)
        ? 'android'
        : 'other',
  })
}

export function fatalIfLiffReturnOutsideLine(inClient: boolean, returning: boolean): void {
  if (!returning || inClient) return
  loginWithAppFatal('liff-return-outside-line-app', 'H14', {
    returning,
    inClient,
  })
}

export function fatalIfLoggedInOutsideLine(inClient: boolean, loggedIn: boolean): void {
  if (inClient || !loggedIn) return
  loginWithAppFatal('liff-logged-in-outside-line-app', 'H15', {
    inClient,
    loggedIn,
  })
}
