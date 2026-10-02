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
  const values = (key: string) => {
    const raw = url.searchParams.getAll(key)
    const parsed = req.query?.[key]
    if (raw.length > 1 || Array.isArray(parsed)) return null
    return [...raw, ...(parsed == null ? [] : [parsed])]
  }
  const competition = values('competition')
  const eventId = values('eventId')
  const inviteCode = values('inviteCode')
  if (!competition || !eventId || !inviteCode) return null
  const pathCode = /^\/c\/([^/]+)\/?$/.exec(url.pathname)?.[1]
  const pathId = /^\/competitions\/([^/]+)(?:\/join)?\/?$/.exec(url.pathname)?.[1]
  const codes = [...inviteCode, ...(pathCode == null ? [] : [pathCode])]
  const ids = [...competition, ...eventId, ...(pathId == null ? [] : [pathId])]
  if (codes.length && ids.length) return null
  const candidates = codes.length ? codes : ids
  const format = codes.length ? shortCode : uuid
  if (!candidates.length || candidates.some(value => !format.test(value))) return null
  const unique = new Set(candidates.map(value => value.toLowerCase()))
  return unique.size === 1 ? [...unique][0] : null
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** A failed lookup must not advertise the generic home page as this competition. */
export function stripShareMetadata(html: string): string {
  return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:property|name)=["'](?:og:[^"']*|twitter:[^"']*|description)["'][^>]*>/gi, '')
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
  const id = competitionIdFromRequest(req)
  const url = new URL(req.url ?? '/', 'https://successpadel.app')
  const isShort = url.pathname.startsWith('/c/') || req.query?.inviteCode != null || url.searchParams.has('inviteCode')
  const isCompetition = isShort || url.pathname.startsWith('/competitions/')
    || ['competition', 'eventId'].some(key => req.query?.[key] != null || url.searchParams.has(key))
  let html = ''
  const unavailable = (status: number) => {
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nosnippet, noimageindex',
      ...(status === 503 ? { 'Retry-After': '60' } : {}),
    })
    // Long links retain the React shell so the normal app can still load/recover.
    const body = !isShort && html ? stripShareMetadata(html)
      : '<!doctype html><html><head></head><body><p>This competition link is unavailable. Please check the link or try again shortly.</p></body></html>'
    res.end(req.method === 'HEAD' ? undefined : body)
  }
  try { html = await template() } catch { return unavailable(503) }
  if (isCompetition && !id) return unavailable(404)
  if (id) {
    try {
      const row = await lookup(id, env)
      if (row) {
        html = injectCompetitionMetadata(html, row)
      } else return unavailable(404)
    } catch {
      console.warn('Competition share metadata unavailable; suppressing preview until retry')
      return unavailable(503)
    }
  }
  // Fetch saved details afresh. Chat applications may still keep their own cache.
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(req.method === 'HEAD' ? undefined : html)
}
