import { signInWithLine } from '../line/auth'
import {
  detectInLineClient,
  hasLiffId,
  initLiff,
  isInLineClient,
  isLineLiffBrowser,
} from '../line/liff'

const LIFF_POLL_MS = 400
const LIFF_READY_TIMEOUT_MS = 45_000

/** True when this page load came from a LIFF / LINE handoff (not a desktop QR display). */
export function hasLiffUrlContext(): boolean {
  const { search, hash } = window.location
  const qs = `${search}${hash}`
  if (
    qs.includes('liff.state') ||
    qs.includes('liff.auth') ||
    qs.includes('liffClientId') ||
    qs.includes('liff.referrer')
  ) {
    return true
  }
  if (document.referrer.includes('liff.line.me')) return true
  return isLineLiffBrowser()
}

export function shouldAutoLineHandshake(): boolean {
  if (!hasLiffId()) return false
  if (hasLiffUrlContext() || isLineLiffBrowser()) return true
  return window.location.pathname === '/login'
}

export async function shouldRunLineHandshake(): Promise<boolean> {
  if (!hasLiffId()) return false
  if (!(hasLiffUrlContext() || isLineLiffBrowser() || window.location.pathname === '/login')) {
    return false
  }
  try {
    await initLiff()
    if (isInLineClient()) return true
    if (hasLiffUrlContext() || isLineLiffBrowser()) {
      return waitForLineAppReady(15_000)
    }
    return false
  } catch {
    return false
  }
}

/** Poll until LINE in-app LIFF is ready (user may need to tap Open in LINE). */
export async function waitForLineAppReady(timeoutMs = LIFF_READY_TIMEOUT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await initLiff()
      if (isInLineClient()) return true
    } catch {
      /* LIFF still booting */
    }
    await new Promise((r) => window.setTimeout(r, LIFF_POLL_MS))
  }
  return false
}

export type LoginWithAppResult = {
  error: string | null
  redirected: boolean
  inClient: boolean
}

/** Run LINE Allow handshake — only when opened from LIFF / LINE, never from desktop QR view. */
export async function runLoginWithAPP(): Promise<LoginWithAppResult> {
  let inClient = await detectInLineClient()
  if (!inClient && (hasLiffUrlContext() || isLineLiffBrowser())) {
    inClient = await waitForLineAppReady()
  }

  if (!inClient) {
    return {
      error: hasLiffUrlContext()
        ? 'Could not connect inside LINE. Copy your reopen link from Profile and open it in LINE.'
        : null,
      redirected: false,
      inClient: false,
    }
  }

  const { error, redirected } = await signInWithLine()
  return { error, redirected, inClient: true }
}
