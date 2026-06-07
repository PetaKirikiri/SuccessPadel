const PREFIX = 'sp_line_link_oauth_'

/** OAuth codes are single-use — skip duplicate processing (e.g. React StrictMode). */
export function shouldProcessLineLinkOAuth(search: string): boolean {
  const code = new URLSearchParams(search).get('code')
  if (!code) return false
  const key = `${PREFIX}${code}`
  if (sessionStorage.getItem(key)) return false
  sessionStorage.setItem(key, '1')
  return true
}
