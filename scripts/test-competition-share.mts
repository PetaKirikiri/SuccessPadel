import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { competitionShareDetails, type ShareCompetition } from '../src/lib/competitionShareDetails'
import { competitionScheduleDisplay } from '../src/lib/competitionGameDisplay'
import { competitionIdFromRequest, handleCompetitionPage, injectCompetitionMetadata, loadPublicCompetition } from '../server/sharing/competitionPage'

const id = 'c1a8521c-0716-4294-b98f-0cfb48fdee7d'
const row = {
  id, title: 'Duo Americano · Intermediate–High Intermediate',
  starts_at: '2026-10-02T11:05:00Z', ends_at: '2026-10-02T13:00:00Z', starts_on: '2026-10-02',
  skill_level: 'Intermediate', skill_level_min_rank: 3, skill_level_max_rank: 4,
  scoring_config: {}, schedule_game_count: 7, schedule_game_minutes: 13, schedule_break_minutes: 4,
} as ShareCompetition
const details = competitionShareDetails(row)
assert.equal(details.title, 'Duo Americano · Inter–High Inter')
assert.equal(details.description, 'Fri, 2 Oct 2026 · 18:05–20:00 · Success Padel Samui')
assert.equal(details.url, `https://successpadel.app/competitive?competition=${id}`)
for (const fixture of [row, { ...row, ends_at: null }]) {
  const invite = competitionScheduleDisplay({ ...fixture, target_players: 16, max_players: 16 }, 'en')
  assert.ok(competitionShareDetails(fixture).description.includes(invite.timeLine), 'Share time matches invite time')
}
const changed = competitionShareDetails({ ...row, title: 'New competition', starts_at: '2027-01-01T18:00:00Z', ends_at: '2027-01-01T20:00:00Z', skill_level_min_rank: 1, skill_level_max_rank: 2 })
assert.equal(changed.title, 'New competition · Beginner–Low Inter')
assert.equal(changed.description, 'Sat, 2 Jan 2027 · 01:00–03:00 · Success Padel Samui')
assert.equal(competitionShareDetails({ ...row, starts_at: null, ends_at: null }).description, 'Fri, 2 Oct 2026 · Success Padel Samui')
assert.equal(competitionShareDetails({ ...row, starts_at: 'invalid', ends_at: 'invalid', starts_on: null }).description, 'Success Padel Samui')

const built = process.argv.includes('--built')
const html = await readFile(built ? 'dist/index.html' : 'index.html', 'utf8')
const rendered = injectCompetitionMetadata(html, row)
for (const tag of ['og:title', 'og:description', 'og:url', 'twitter:title', 'twitter:description']) {
  assert.equal(rendered.split(`"${tag}"`).length - 1, 1, `${tag} appears once`)
}
assert.equal((rendered.match(/<title>/g) ?? []).length, 1)
assert.ok(rendered.includes('success-padel-chest-preview-v1.jpg'))
assert.ok(rendered.includes(built ? '/assets/index-' : '/src/main.tsx'))
const hostile = injectCompetitionMetadata(html, { ...row, title: '"><script>alert(1)</script>' })
assert.ok(!hostile.includes('<script>alert(1)</script>'))
assert.ok(hostile.includes('&lt;script&gt;'))
for (const url of [`/competitive?competition=${id}`, `/competitions/${id}`, `/api/competition-share?competition=${id}`]) {
  assert.equal(competitionIdFromRequest({ url }), id)
}
assert.equal(competitionIdFromRequest({ url: `/competitive?competition=${id}&competition=${id}` }), null)
assert.equal(competitionIdFromRequest({ url: '/competitive?competition=invalid' }), null)
assert.equal(competitionIdFromRequest({ url: '/', query: { competition: [id] } }), null)

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
assert.equal(await loadPublicCompetition('00000000-0000-0000-0000-000000000000', env, fetcher), null)
assert.equal(await loadPublicCompetition(id, env, async () => Response.json([row, row])), null)
await assert.rejects(loadPublicCompetition(id, env, async () => new Response('', { status: 503 })))

let lookupCount = 0
let fail = false
const server = createServer((req, res) => {
  void handleCompetitionPage(req, res, env, built ? undefined : async () => html, async requested => {
    lookupCount++
    if (fail) throw new Error('Temporary outage')
    return requested === id ? row : null
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
  assert.equal(await (await fetch(`${base}/competitive?competition=invalid`)).text(), html)
  fail = true
  const fallback = await fetch(url)
  assert.equal(fallback.status, 200)
  assert.equal(await fallback.text(), html, 'Metadata outage must not block the app')
} finally {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}
const config = JSON.parse(await readFile('vercel.json', 'utf8'))
assert.equal(config.functions['api/competition-share.ts'].includeFiles, 'dist/index.html')
assert.equal(config.rewrites[0].source, '/competitive')
assert.equal(config.rewrites[1].source, '/competitions/:eventId')
console.log('Competition sharing: live fields, invite consistency, timezone, escaping, request guards, public reads, shell preservation and outage fallback passed')
