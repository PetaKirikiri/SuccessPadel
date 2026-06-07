const PRODUCTION_ORIGIN = 'https://success-padel-ffzt.vercel.app'

/** True when viewing the app on a dev machine / tunnel (not production Vercel). */
export function isDevHost(): boolean {
  const host = window.location.hostname
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.trycloudflare.com') ||
    host.endsWith('.ngrok-free.app') ||
    host.endsWith('.loca.lt')
  )
}

function isLocalDev(): boolean {
  return isDevHost()
}

/** HTTPS origin for LINE LIFF during local dev — set VITE_DEV_PUBLIC_URL to your tunnel URL. */
export function devPublicOrigin(): string {
  const configured = (import.meta.env.VITE_DEV_PUBLIC_URL as string | undefined)?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return window.location.origin
}

/** App origin for in-app navigation. */
export function siteOrigin(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined
  if (configured?.trim()) return configured.trim().replace(/\/$/, '')
  return window.location.origin
}

/** Origin for share/publish links — always production when developing locally. */
export function shareSiteOrigin(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined
  if (configured?.trim()) return configured.trim().replace(/\/$/, '')
  if (isLocalDev()) return PRODUCTION_ORIGIN
  return window.location.origin
}

export function competitionPlayUrl(sessionId: string): string {
  return `${shareSiteOrigin()}/competitions/${sessionId}`
}

export function competitionJoinUrl(sessionId: string): string {
  return `${shareSiteOrigin()}/competitions/${sessionId}/join`
}

