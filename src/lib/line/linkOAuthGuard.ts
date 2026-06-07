const PREFIX = 'sp_line_link_oauth_'
const inflightCodes = new Set<string>()

/** OAuth codes are single-use — one in-flight handler per code (StrictMode-safe). */
export function beginLineLinkOAuth(search: string): string | null {
  const code = new URLSearchParams(search).get('code')
  if (!code) return null
  if (sessionStorage.getItem(`${PREFIX}${code}`) === 'done') return null
  if (inflightCodes.has(code)) return null
  inflightCodes.add(code)
  return code
}

export function finishLineLinkOAuth(code: string, success: boolean): void {
  inflightCodes.delete(code)
  if (success) sessionStorage.setItem(`${PREFIX}${code}`, 'done')
}
