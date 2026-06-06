import liff from '@line/liff'

const liffId = import.meta.env.VITE_LIFF_ID as string | undefined

let initPromise: Promise<void> | null = null

export function hasLiffId(): boolean {
  return Boolean(liffId)
}

export async function initLiff(): Promise<void> {
  if (!liffId) return
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

export function lineLoginRedirect(): void {
  if (!liffId) return
  liff.login({ redirectUri: window.location.href })
}

export function liffShareUrl(): string | null {
  if (!liffId) return null
  return `https://liff.line.me/${liffId}`
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
