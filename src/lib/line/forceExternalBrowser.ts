import { hasLiffId, initLiff, isInLineClient, isLineLiffBrowser } from './liff'
import liff from '@line/liff'

const RETRY_MS = [0, 120, 300, 600, 1200, 2000] as const

function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

function iosSafariSchemeUrl(httpsUrl: string): string {
  return httpsUrl.replace(/^https:\/\//i, 'x-safari-https://')
}

function androidIntentUrl(httpsUrl: string): string {
  const parsed = new URL(httpsUrl)
  const path = `${parsed.pathname}${parsed.search}`
  return `intent://${parsed.host}${path}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`
}

async function tryLiffExternalOpen(url: string): Promise<boolean> {
  if (!hasLiffId()) return false
  try {
    await initLiff()
    if (!liff.isApiAvailable('openWindow')) return false
    liff.openWindow({ url, external: true })
    return true
  } catch {
    return false
  }
}

function tryPlatformScheme(url: string): boolean {
  if (!isLineLiffBrowser()) return false
  try {
    if (isIos()) {
      window.location.assign(iosSafariSchemeUrl(url))
      return true
    }
    if (isAndroid()) {
      window.location.assign(androidIntentUrl(url))
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/** Programmatic open — not a normal hyperlink. Used after QR scan handoff. */
export async function forceOpenInSystemBrowser(url: string): Promise<boolean> {
  if (/^https:\/\/liff\.line\.me/i.test(url)) return false

  if (await tryLiffExternalOpen(url)) return true
  if (tryPlatformScheme(url)) return true

  if (isLineLiffBrowser() || isInLineClient()) return false

  window.location.replace(url)
  return true
}

/** Hidden full-screen control + synthetic click to satisfy LINE gesture rules. */
export function programmaticExternalOpen(url: string): void {
  const existing = document.getElementById('sp-ext-open-btn')
  existing?.remove()

  const btn = document.createElement('button')
  btn.id = 'sp-ext-open-btn'
  btn.type = 'button'
  btn.setAttribute('aria-hidden', 'true')
  btn.tabIndex = -1
  btn.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;opacity:0;border:0;padding:0;margin:0;width:100%;height:100%;cursor:default;'
  btn.onclick = (e) => {
    e.preventDefault()
    void forceOpenInSystemBrowser(url)
  }
  document.body.appendChild(btn)
  btn.click()
}

export function scheduleForceExternalOpen(
  url: string,
  onExhausted?: () => void,
): () => void {
  const timers: number[] = []
  let tried = 0

  const attempt = () => {
    tried += 1
    void forceOpenInSystemBrowser(url).then((ok) => {
      if (!ok && tried >= RETRY_MS.length) onExhausted?.()
    })
    programmaticExternalOpen(url)
  }

  for (const delay of RETRY_MS) {
    timers.push(window.setTimeout(attempt, delay))
  }

  const onGesture = () => attempt()
  document.addEventListener('touchstart', onGesture, { capture: true })
  document.addEventListener('pointerdown', onGesture, { capture: true })
  document.addEventListener('click', onGesture, { capture: true })

  return () => {
    for (const id of timers) window.clearTimeout(id)
    document.removeEventListener('touchstart', onGesture, { capture: true })
    document.removeEventListener('pointerdown', onGesture, { capture: true })
    document.removeEventListener('click', onGesture, { capture: true })
    document.getElementById('sp-ext-open-btn')?.remove()
  }
}
