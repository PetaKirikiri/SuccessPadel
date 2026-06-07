import { Capacitor } from '@capacitor/core'

/** Must match LINE Developers callback URL and native URL scheme (successpadel://login). */
export const NATIVE_LINE_REDIRECT_URI = 'successpadel://login'

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function oauthSearchFromDeepLink(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'successpadel:') return null
    if (parsed.hostname !== 'login' && !parsed.pathname.startsWith('/login')) return null
    return parsed.search || ''
  } catch {
    return null
  }
}
