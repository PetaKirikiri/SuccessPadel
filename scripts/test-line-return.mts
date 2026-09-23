import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { safeReturnPath, originalReturnPath, lineReturnEntryUrl, carriedReturnPath, canonicalResumeUrl } from '../src/lib/line/returnDestination'
import { recogniseExistingLineMember } from '../supabase/functions/_shared/lineRecognition'

const destinations = [
  '/c/9df4f70a',
  '/c/another-event',
  '/competitive?competition=c446edaf-3437-4084-ada8-e1008df8296f',
  '/players/dave?competition=another-id#feedback',
  '/competitions/another-id?game=4',
]
for (const destination of destinations) {
  const entry = new URL(lineReturnEntryUrl('test-liff-id', destination))
  assert.equal(entry.pathname, '/test-liff-id')
  assert.equal(carriedReturnPath(entry.href), destination)
  for (const endpoint of ['https://successpadel.app/', 'https://legacy.vercel.app/login']) {
    const primary = new URL(endpoint)
    primary.searchParams.set('liff.state', entry.search)
    assert.equal(carriedReturnPath(primary.href), destination)
    const secondary = new URL(endpoint)
    secondary.search = entry.search
    assert.equal(carriedReturnPath(secondary.href), destination)
    const resume = new URL(canonicalResumeUrl(carriedReturnPath(secondary.href)!, 'one-use-test-ticket'))
    assert.equal(resume.origin, 'https://successpadel.app')
    assert.equal(carriedReturnPath(resume.href), destination)
    assert.ok(!resume.search.includes('ticket'))
    assert.equal(new URLSearchParams(resume.hash.slice(1)).get('ticket'), 'one-use-test-ticket')
    assert.equal(new URL(canonicalResumeUrl(destination)).hash, '')
  }
}
assert.equal(originalReturnPath('/competitive?competition=9df4f70a-2532-4f11-9a6d-013ab7110c25&sp_line_attempt=1'), '/c/9df4f70a')
assert.equal(originalReturnPath('/competitive?competition=different-event'), '/competitive?competition=different-event')
for (const invalid of ['//evil.example/c/test', 'https://evil.example/c/test', '/\\evil.example', '/login', '/login/competitive', '/auth/line/resume', 'javascript:alert(1)', '/%2f%2fevil.example', 'https://successpadel.app@evil.example/c/test']) {
  assert.equal(safeReturnPath(invalid), null, invalid)
}
assert.equal(safeReturnPath('https://successpadel.app/c/9df4f70a'), '/c/9df4f70a')
assert.equal(safeReturnPath('/c/test?code=secret&state=secret&liff.state=secret'), '/c/test')

let verified = false
const issued = await recogniseExistingLineMember('verified-by-LINE', {
  verify: async () => { verified = true; return `U${'a'.repeat(32)}` },
  findProfile: async () => { assert.ok(verified); return 'existing-member' },
  issueSession: async id => { assert.equal(id, 'existing-member'); return { ticket: 'single-use' } },
})
assert.deepEqual(issued, { recognised: true, ticket: 'single-use' })
const gate = readFileSync('src/foundation/line/LineEntryGate.tsx', 'utf8')
const modal = readFileSync('src/shared/Modal/LineSignInModal.tsx', 'utf8')
const adapter = readFileSync('src/lib/line/returnHandoff.ts', 'utf8')
assert.match(gate, /lineSignInEntryUrl\(entryPath\)/)
assert.match(modal, /lineSignInEntryUrl\(destination\)/)
assert.doesNotMatch(modal, /lineAppEntryUrl\('\/friendly'\)/)
assert.match(adapter, /if \(!handoff\)/)
assert.match(adapter, /if \(!resume\)/)
assert.match(adapter, /controller\.signal\.aborted/)
assert.match(adapter, /if \(current\.session\) return/)
assert.doesNotMatch(adapter, /9df4f70a|vercel\.app/)
const logger = readFileSync('src/lib/debug/loginWithAppDebug.ts', 'utf8')
assert.doesNotMatch(logger, /(?:pageUrl|href):\s*window\.location\.href/)
console.log('PASS: dynamic destinations, LIFF primary/secondary, legacy host, one-use handoff, guest return, unsafe destinations, callback deduplication, QR wiring')
