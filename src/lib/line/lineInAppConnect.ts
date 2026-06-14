import { peekClaimPadelPlayer } from '../authClaimPlayer'
import { claimPendingPadelPlayer } from '../claimPadelPlayer'
import { lineHandshakeDebug } from '../debug/lineHandshakeDebug'
import { signInWithLine } from './auth'
import {
  detectInLineClient,
  hasLiffId,
  initLiff,
  isInLineClient,
  isLineLiffBrowser,
  isLineLoggedIn,
} from './liff'
import { liffIdFingerprint } from '../debug/loginWithAppDebug'

const LIFF_INIT_MS = 12_000

export type LineInAppSignInResult = {
  ok: boolean
  redirected: boolean
  error: string | null
  skipped: boolean
}

async function initLiffWithTimeout(): Promise<boolean> {
  if (!hasLiffId()) return false
  try {
    await Promise.race([
      initLiff(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('LIFF init timed out')), LIFF_INIT_MS)
      }),
    ])
    return true
  } catch {
    return false
  }
}

/** True when we should try LIFF sign-in on this page load. */
export function shouldTryLineInAppSignIn(isAuthenticated: boolean): boolean {
  if (isAuthenticated || !hasLiffId()) return false
  return isLineLiffBrowser()
}

/**
 * Inside LINE: read LIFF session → match line_user_id → Supabase session.
 * No player-link / QR flow here — that stays on /link and profile UI.
 */
export async function runLineInAppSignIn(
  isAuthenticated: boolean,
): Promise<LineInAppSignInResult> {
  // #region agent log
  lineHandshakeDebug('S2-env', 'lineInAppConnect.ts:entry', 'runLineInAppSignIn start', 'H1', {
    isAuthenticated,
    isLineBrowser: isLineLiffBrowser(),
    liffId: liffIdFingerprint(),
  })
  // #endregion

  if (isAuthenticated) {
    if (peekClaimPadelPlayer()) {
      const claimErr = await claimPendingPadelPlayer()
      if (claimErr && !/already linked/i.test(claimErr)) {
        return { ok: false, redirected: false, error: claimErr, skipped: false }
      }
    }
    return { ok: true, redirected: false, error: null, skipped: true }
  }

  if (!isLineLiffBrowser()) {
    const inClient = await detectInLineClient()
    // #region agent log
    lineHandshakeDebug('S2-env', 'lineInAppConnect.ts:detect', 'not line UA, detectInLineClient', 'H2', {
      inClient,
    })
    // #endregion
    if (!inClient) {
      return { ok: true, redirected: false, error: null, skipped: true }
    }
  }

  const liffOk = await initLiffWithTimeout()
  // #region agent log
  lineHandshakeDebug('S3-liff', 'lineInAppConnect.ts:init', 'LIFF init result', 'H2', {
    liffOk,
    inClient: isInLineClient(),
    lineLoggedIn: isLineLoggedIn(),
  })
  // #endregion

  if (!liffOk) {
    return {
      ok: false,
      redirected: false,
      error: 'LINE could not start. Close this tab and reopen from LINE.',
      skipped: false,
    }
  }

  if (!isInLineClient()) {
    // #region agent log
    lineHandshakeDebug('S3-liff', 'lineInAppConnect.ts:skip', 'not in LINE client after init', 'H2', {})
    // #endregion
    return { ok: true, redirected: false, error: null, skipped: true }
  }

  const { error, redirected } = await signInWithLine()
  // #region agent log
  lineHandshakeDebug('S5-auth', 'lineInAppConnect.ts:signIn', 'signInWithLine returned', 'H4', {
    redirected,
    error,
  })
  // #endregion

  if (redirected) {
    return { ok: false, redirected: true, error: null, skipped: false }
  }
  return { ok: !error, redirected: false, error, skipped: false }
}
