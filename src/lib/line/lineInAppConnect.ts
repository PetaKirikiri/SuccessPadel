import { peekClaimPadelPlayer } from '../authClaimPlayer'
import { claimPendingPadelPlayer } from '../claimPadelPlayer'
import { signInWithLine } from './auth'
import { detectInLineClient, hasLiffId, initLiff, isInLineClient, isLineLiffBrowser } from './liff'

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
    if (!inClient) {
      return { ok: true, redirected: false, error: null, skipped: true }
    }
  }

  if (!(await initLiffWithTimeout())) {
    return {
      ok: false,
      redirected: false,
      error: 'LINE could not start. Close this tab and reopen from LINE.',
      skipped: false,
    }
  }

  if (!isInLineClient()) {
    return { ok: true, redirected: false, error: null, skipped: true }
  }

  const { error, redirected } = await signInWithLine()
  if (redirected) {
    return { ok: false, redirected: true, error: null, skipped: false }
  }
  return { ok: !error, redirected: false, error, skipped: false }
}
