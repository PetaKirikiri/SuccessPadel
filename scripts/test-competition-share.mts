import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { competitionShareDetails, type ShareCompetition } from '../src/lib/competitionShareDetails'
import { competitionScheduleDisplay } from '../src/lib/competitionGameDisplay'
import { competitionIdFromRequest, handleCompetitionPage, injectCompetitionMetadata, loadPublicCompetition, stripShareMetadata } from '../server/sharing/competitionPage'

const id = 'c1a8521c-0716-4294-b98f-0cfb48fdee7d'
const row = {
  id, title: 'Duo Americano · Intermediate–High Intermediate',
  starts_at: '2026-10-02T11:05:00Z', ends_at: '2026-10-02T13:00:00Z', starts_on: '2026-10-02',
  skill_level: 'Intermediate', skill_level_min_rank: 3, skill_level_max_rank: 4,
  scoring_config: {}, schedule_game_count: 7, schedule_game_minutes: 13, schedule_break_minutes: 4,
} as ShareCompetition
const details = competitionShareDetails(row)
assert.equal(details.title, '18:05–20:00 · Fri, 2 Oct 2026')
assert.equal(details.description, 'Duo Americano · Inter–High Inter · Success Padel Samui')
assert.equal(details.url, 'https://successpadel.app/c/c1a8521c')
for (const fixture of [row, { ...row, ends_at: null }]) {
  const invite = competitionScheduleDisplay({ ...fixture, target_players: 16, max_players: 16 }, 'en')
  assert.ok(competitionShareDetails(fixture).title.startsWith(invite.timeLine), 'Share time is prominent and matches invite time')
}
const changed = competitionShareDetails({ ...row, title: 'New competition', starts_at: '2027-01-01T18:00:00Z', ends_at: '2027-01-01T20:00:00Z', skill_level_min_rank: 1, skill_level_max_rank: 2 })
assert.equal(changed.title, '01:00–03:00 · Sat, 2 Jan 2027')
assert.equal(changed.description, 'New competition · Beginner–Low Inter · Success Padel Samui')
assert.equal(competitionShareDetails({ ...row, starts_at: null, ends_at: null }).title, 'Fri, 2 Oct 2026')
assert.equal(competitionShareDetails({ ...row, starts_at: 'invalid', ends_at: 'invalid', starts_on: null }).title, 'Duo Americano')

const built = process.argv.includes('--built')
const html = await readFile(built ? 'dist/index.html' : 'index.html', 'utf8')
const rendered = injectCompetitionMetadata(html, row)
for (const tag of ['og:title', 'og:description', 'og:url', 'twitter:title', 'twitter:description']) {
  assert.equal(rendered.split(`"${tag}"`).length - 1, 1, `${tag} appears once`)
}
assert.equal((rendered.match(/<title>/g) ?? []).length, 1)
assert.ok(rendered.includes('success-padel-chest-preview-v1.jpg'))
assert.ok(rendered.includes(built ? '/assets/index-' : '/src/main.tsx'))
assert.ok(!rendered.includes('Live leaderboard and scores for Success Padel Samui.'))
assert.ok(!rendered.includes('Success Padel — Americano Competition'))
assert.equal((rendered.match(/property="og:image"/g) ?? []).length, 1)
const stripped = stripShareMetadata(rendered)
assert.ok(!/(?:og:|twitter:|<title>)/.test(stripped), 'Unavailable event cannot advertise another preview')
assert.ok(stripped.includes(built ? '/assets/index-' : '/src/main.tsx'), 'Unavailable metadata preserves app startup')
const hostile = injectCompetitionMetadata(html, { ...row, title: '"><script>alert(1)</script>' })
assert.ok(!hostile.includes('<script>alert(1)</script>'))
assert.ok(hostile.includes('&lt;script&gt;'))
for (const url of [`/competitive?competition=${id}`, `/competitions/${id}`, `/api/competition-share?competition=${id}`]) {
  assert.equal(competitionIdFromRequest({ url }), id)
}
assert.equal(competitionIdFromRequest({ url: `/competitive?competition=${id}&competition=${id}` }), null)
assert.equal(competitionIdFromRequest({ url: '/competitive?competition=invalid' }), null)
assert.equal(competitionIdFromRequest({ url: '/', query: { competition: [id] } }), null)
assert.equal(competitionIdFromRequest({ url: '/c/C1A8521C' }), 'c1a8521c')
assert.equal(competitionIdFromRequest({ url: '/api/competition-share?inviteCode=c1a8521c' }), 'c1a8521c')
assert.equal(competitionIdFromRequest({ url: '/c/invalid' }), null)
assert.equal(competitionIdFromRequest({ url: `/c/c1a8521c?competition=${id}` }), null)
assert.equal(competitionIdFromRequest({ url: `/competitions/${id}?competition=00000000-0000-0000-0000-000000000000` }), null)
assert.equal(competitionIdFromRequest({ url: `/competitive?competition=${id}`, query: { competition: '00000000-0000-0000-0000-000000000000' } }), null)
assert.equal(competitionIdFromRequest({ url: '/c/c1a8521c?inviteCode=00000000' }), null)
assert.equal(competitionIdFromRequest({ url: `/api/competition-share?eventId=${id}`, query: { eventId: id } }), id)
assert.ok(!rendered.includes('data-competition-entry'), 'No bootstrap script expands the clean address')

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-test-key' }
const fetcher: typeof fetch = async (url, options) => {
  assert.equal(url, 'https://example.supabase.co/rest/v1/rpc/list_competitions_for_setup')
  assert.equal(options?.method, 'POST')
  assert.equal(options?.body, '{}')
  const headers = new Headers(options?.headers)
  assert.equal(headers.get('authorization'), 'Bearer public-test-key')
  assert.equal(headers.has('cookie'), false)
  return Response.json([row])
}
assert.equal((await loadPublicCompetition(id, env, fetcher))?.id, id)
assert.equal((await loadPublicCompetition('c1a8521c', env, fetcher))?.id, id)
assert.equal(await loadPublicCompetition('c1a8521c', env, async () => Response.json([row, { ...row, id: 'c1a8521c-0000-0000-0000-000000000000' }])), null, 'Ambiguous prefixes never open another competition')
assert.equal(await loadPublicCompetition('00000000-0000-0000-0000-000000000000', env, fetcher), null)
assert.equal(await loadPublicCompetition(id, env, async () => Response.json([row, row])), null)
await assert.rejects(loadPublicCompetition(id, env, async () => new Response('', { status: 503 })))

let lookupCount = 0
let fail = false
const server = createServer((req, res) => {
  void handleCompetitionPage(req, res, env, built ? undefined : async () => html, async requested => {
    lookupCount++
    if (fail) throw new Error('Temporary outage')
    return requested === id || requested === 'c1a8521c' ? row : null
  }).catch(error => { res.statusCode = 500; res.end(String(error)) })
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}`
  const url = `${base}/competitive?competition=${id}&view=review`
  const response = await fetch(url)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(await response.text(), rendered)
  await fetch(url)
  assert.equal(lookupCount, 2, 'Fresh saved details are read on every request')
  const head = await fetch(url, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  assert.equal((await fetch(url, { method: 'POST' })).status, 405)
  const invalid = await fetch(`${base}/competitive?competition=invalid`)
  assert.equal(invalid.status, 404)
  assert.equal(await invalid.text(), stripShareMetadata(html))
  const short = await fetch(`${base}/c/c1a8521c`)
  assert.equal(short.status, 200)
  assert.equal(short.redirected, false)
  assert.equal(await short.text(), rendered, 'Short and legacy links serve identical preview and app HTML')
  assert.equal((await fetch(`${base}/c/00000000`)).status, 404)
  assert.equal((await fetch(`${base}/c/invalid`)).status, 404)
  for (const path of [`/competitive?competition=${id}&preview=2`, `/competitive/?competition=${id}&view=review`, `/competitions/${id}`, `/competitions/${id}/`, `/competitions/${id}/join`, `/competitions/${id}/join/`, `/api/competition-share?eventId=${id}`]) {
    const response = await fetch(base + path)
    assert.equal(response.status, 200, path)
    assert.equal(await response.text(), rendered, path)
  }
  assert.equal(await (await fetch(`${base}/c/c1a8521c/`)).text(), rendered)
  assert.equal((await fetch(`${base}/competitive?competition=00000000-0000-0000-0000-000000000000`)).status, 404)
  assert.equal(await (await fetch(`${base}/competitive`)).text(), html, 'Ordinary hub still works')
  fail = true
  assert.equal((await fetch(`${base}/c/c1a8521c`)).status, 503)
  const fallback = await fetch(url)
  assert.equal(fallback.status, 503)
  assert.equal(fallback.headers.get('retry-after'), '60')
  assert.equal(fallback.headers.get('x-robots-tag'), 'noindex, nosnippet, noimageindex')
  assert.equal(await fallback.text(), stripShareMetadata(html), 'Outages retain app startup without misleading previews')
  const failedHead = await fetch(url, { method: 'HEAD' })
  assert.equal(failedHead.status, 503)
  assert.equal(await failedHead.text(), '')
} finally {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}
const config = JSON.parse(await readFile('vercel.json', 'utf8'))
assert.equal(config.functions['api/competition-share.ts'].includeFiles, 'dist/index.html')
assert.equal(config.rewrites[0].source, '/c/:inviteCode')
for (const path of ['/c/:inviteCode', '/c/:inviteCode/', '/competitive', '/competitive/', '/competitions/:eventId', '/competitions/:eventId/', '/competitions/:eventId/join', '/competitions/:eventId/join/']) {
  const index = config.rewrites.findIndex((rule: { source: string }) => rule.source === path)
  assert.ok(index >= 0 && index < config.rewrites.length - 1, `${path} resolves before the generic shell`)
  assert.ok(config.rewrites[index].destination.startsWith('/api/competition-share'))
  if (path.startsWith('/competitive') && !path.startsWith('/competitions')) {
    assert.deepEqual(config.rewrites[index].has, [{ type: 'query', key: 'competition' }], 'Malformed values cannot bypass validation')
  }
}
console.log('Competition sharing: date-first metadata, all link variants, identity conflicts, missing events, outages, app preservation and route guards passed')
