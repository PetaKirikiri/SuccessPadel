/** Redirect URL for Supabase auth emails — always the device you're on now, not localhost. */
export function authRedirectUrl(path = '/auth/callback'): string {
  return `${window.location.origin}${path}`
}
