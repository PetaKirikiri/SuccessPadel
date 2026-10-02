import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { competitionShareDetails, type ShareCompetition } from '../../src/lib/competitionShareDetails.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Request = IncomingMessage & { query?: Record<string, string | string[] | undefined> }
type Environment = Record<string, string | undefined>

export function competitionIdFromRequest(req: Pick<Request, 'url' | 'query'>): string | null {
  const url = new URL(req.url ?? '/', 'https://successpadel.app')
  const values = url.searchParams.getAll('competition')
  const queryId = req.query?.competition
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
  const matches = rows.filter(row => typeof row?.id === 'string' && row.id.toLowerCase() === id)
  return matches.length === 1 ? matches[0] : null
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
    .replace('</head>', `<title>${title}</title>
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta name="description" content="${description}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
</head>`)
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
  if (id) {
    try {
      const row = await lookup(id, env)
      if (row) html = injectCompetitionMetadata(html, row)
    } catch {
      // A preview lookup must never prevent a player opening the normal app.
      console.warn('Competition share metadata unavailable; serving the normal app shell')
    }
  }
  // Fetch saved details afresh. Chat applications may still keep their own cache.
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(req.method === 'HEAD' ? undefined : html)
}
