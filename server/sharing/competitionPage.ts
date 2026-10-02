import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { competitionShareDetails, type ShareCompetition } from '../../src/lib/competitionShareDetails.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const shortCode = /^[0-9a-f]{8}$/i
type Request = IncomingMessage & { query?: Record<string, string | string[] | undefined> }
type Environment = Record<string, string | undefined>

export function competitionIdFromRequest(req: Pick<Request, 'url' | 'query'>): string | null {
  const url = new URL(req.url ?? '/', 'https://successpadel.app')
  const values = url.searchParams.getAll('competition')
  const queryId = req.query?.competition
  const pathCode = /^\/c\/([^/]+)\/?$/.exec(url.pathname)?.[1]
  const code = pathCode ?? req.query?.inviteCode ?? url.searchParams.get('inviteCode')
  if (code != null) {
    if (queryId != null || values.length || Array.isArray(code) || url.searchParams.getAll('inviteCode').length > 1) return null
    return shortCode.test(code) ? code.toLowerCase() : null
  }
  if (values.length > 1 || Array.isArray(queryId)) return null
  const pathId = /^\/competitions\/([^/]+)\/?$/.exec(url.pathname)?.[1]
  const id = queryId ?? values[0] ?? pathId
  return typeof id === 'string' && uuid.test(id) ? id.toLowerCase() : null
}

export async function loadPublicCompetition(id: string, env: Environment, fetcher = fetch): Promise<ShareCompetition | null> {
  const origin = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!origin || !key) throw new Error('Public competition configuration unavailable')
  // Same public RPC as the invite page. Never use an admin key or visitor cookies.
  const result = await fetcher(`${origin}/rest/v1/rpc/list_competitions_for_setup`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(4000),
  })
  if (!result.ok) throw new Error('Public competition lookup failed')
  const rows = await result.json()
  if (!Array.isArray(rows)) throw new Error('Invalid public competition response')
  const matches = rows.filter(row => typeof row?.id === 'string' && uuid.test(row.id) && (
    shortCode.test(id) ? row.id.toLowerCase().startsWith(`${id.toLowerCase()}-`) : row.id.toLowerCase() === id.toLowerCase()
  ))
  return matches.length === 1 ? matches[0] : null
}

/** Resolve the normal app route before React/LINE initialize, without an HTTP redirect
 * that would send preview crawlers back to the previously cached long URL. */
export function injectInviteEntry(html: string, id: string): string {
  if (!uuid.test(id)) throw new Error('Invalid competition identity')
  return html.replace('</head>', `<script data-competition-entry>
if (/^\\/c\\/[0-9a-f]{8}\\/?$/i.test(location.pathname)) {
  const destination = new URL(location.href);
  destination.pathname = '/competitive';
  destination.searchParams.delete('preview');
  destination.searchParams.delete('inviteCode');
  destination.searchParams.set('competition', ${JSON.stringify(id)});
  history.replaceState(history.state, '', destination.pathname + destination.search + destination.hash);
}
</script></head>`)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function injectCompetitionMetadata(html: string, row: ShareCompetition): string {
  const details = competitionShareDetails(row)
  const title = escapeHtml(details.title)
  const description = escapeHtml(details.description)
  const url = escapeHtml(details.url)
  // Preserve the complete app shell, approved image tags and JS asset paths.
  return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:property|name)=["'](?:og:title|og:description|og:url|twitter:title|twitter:description|description)["'][^>]*>/gi, '')
    .replace('<head>', `<head><title>${title}</title>
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta name="description" content="${description}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />`)
}

export async function handleCompetitionPage(
  req: Request, res: ServerResponse, env: Environment = process.env,
  template = () => readFile(join(process.cwd(), 'dist/index.html'), 'utf8'),
  lookup = loadPublicCompetition,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }
  let html = await template()
  const id = competitionIdFromRequest(req)
  const url = new URL(req.url ?? '/', 'https://successpadel.app')
  const isShort = url.pathname.startsWith('/c/') || req.query?.inviteCode != null || url.searchParams.has('inviteCode')
  const unavailable = (status: number) => {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(req.method === 'HEAD' ? undefined : '<!doctype html><html><head><title>Success Padel</title></head><body><p>This competition link is unavailable. Please check the link or try again shortly.</p></body></html>')
  }
  if (isShort && !id) return unavailable(404)
  if (id) {
    try {
      const row = await lookup(id, env)
      if (row) {
        html = injectCompetitionMetadata(html, row)
        if (isShort) html = injectInviteEntry(html, row.id)
      } else if (isShort) return unavailable(404)
    } catch {
      if (isShort) return unavailable(503)
      // A preview lookup must never prevent a player opening the normal app.
      console.warn('Competition share metadata unavailable; serving the normal app shell')
    }
  }
  // Fetch saved details afresh. Chat applications may still keep their own cache.
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(req.method === 'HEAD' ? undefined : html)
}
