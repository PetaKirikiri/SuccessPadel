import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recogniseLineAccount, passiveLineEntryPath, isLineEntryBrowser } from '../src/lib/line/passiveRecognition.ts'
import { recogniseExistingLineMember } from '../supabase/functions/_shared/lineRecognition.ts'

const tokenPair = { access_token: 'test-access', refresh_token: 'test-refresh' }
const lineId = `U${'a'.repeat(32)}`
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
function storage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}
function steps(overrides = {}) {
  const calls = []
  return { calls, deps: {
    init: async () => { calls.push('init') },
    token: async () => { calls.push('token'); return 'verified-on-server' },
    exchange: async () => { calls.push('exchange'); return tokenPair },
    apply: async () => { calls.push('apply') },
    mayContinue: () => true,
    ...overrides,
  } }
}

test('existing member recognised in the background, once through each step', async () => {
  const { calls, deps } = steps()
  assert.equal(await recogniseLineAccount(deps), 'recognised')
  assert.deepEqual(calls, ['init', 'token', 'exchange', 'apply'])
})
test('unconsented LINE session stays guest without invoking auth', async () => {
  const { calls, deps } = steps({ token: async () => null })
  assert.equal(await recogniseLineAccount(deps), 'guest')
  assert.deepEqual(calls, ['init'])
})
test('unrecognised member stays guest without installing a session', async () => {
  const { calls, deps } = steps({ exchange: async () => null })
  assert.equal(await recogniseLineAccount(deps), 'guest')
  assert.ok(!calls.includes('apply'))
})
for (const stage of ['init', 'token', 'exchange', 'apply']) {
  test(`${stage} rejection is contained, not an endless handshake`, async () => {
    const { deps } = steps({ [stage]: async () => { throw new Error('offline/denied') } })
    assert.equal(await recogniseLineAccount(deps), 'guest')
  })
}
for (const stage of ['init', 'token', 'exchange']) {
  test(`late ${stage} result after timeout cannot sign in`, async () => {
    let release
    const { calls, deps } = steps({ [stage]: () => new Promise(resolve => { release = resolve }) })
    assert.equal(await recogniseLineAccount(deps, 10), 'timeout')
    release(stage === 'exchange' ? tokenPair : 'late-token')
    await pause(0)
    assert.ok(!calls.includes('apply'))
  })
}
test('network request receives cancellation on timeout', async () => {
  let signal
  const { deps } = steps({ exchange: async (_token, nextSignal) => {
    signal = nextSignal
    return new Promise(() => {})
  } })
  assert.equal(await recogniseLineAccount(deps, 10), 'timeout')
  assert.equal(signal.aborted, true)
})
test('restored/manual account is never replaced by a late recognition result', async () => {
  let allowed = true
  const { calls, deps } = steps({ mayContinue: () => allowed, exchange: async () => {
    allowed = false
    return tokenPair
  } })
  assert.equal(await recogniseLineAccount(deps), 'guest')
  assert.ok(!calls.includes('apply'))
})
test('handoff preserves exact competition, view and hash; never repeats after navigation', () => {
  const store = storage()
  const url = 'https://successpadel.app/competitive?competition=9df4f70a-2532-4f11-9a6d-013ab7110c25&view=current#players'
  const path = passiveLineEntryPath(url, store)
  assert.equal(path, '/competitive?competition=9df4f70a-2532-4f11-9a6d-013ab7110c25&view=current&sp_line_attempt=1#players')
  assert.equal(passiveLineEntryPath(url, store), null)
  assert.equal(passiveLineEntryPath('https://successpadel.app/players/dave', store), null)
  assert.equal(passiveLineEntryPath(`https://another-origin.example${path}`, storage()), null)
})
test('blocked or silently nonpersistent storage does not redirect', () => {
  assert.equal(passiveLineEntryPath('https://successpadel.app/competitive', {
    getItem: () => { throw new Error('storage blocked') }, setItem: () => {},
  }), null)
  assert.equal(passiveLineEntryPath('https://successpadel.app/competitive', {
    getItem: () => null, setItem: () => {},
  }), null)
})
test('LIFF primary/secondary redirects are never restarted', () => {
  assert.equal(passiveLineEntryPath('https://successpadel.app/?liff.state=%2Fcompetitive%3Fcompetition%3Dtest', storage()), null)
  assert.equal(passiveLineEntryPath('https://successpadel.app/?liff.referrer=test', storage()), null)
})
test('WhatsApp, Safari, Chrome stay untouched; LINE UA or SDK client recognised', () => {
  for (const ua of ['Mozilla/5.0 Safari/604.1', 'WhatsApp/2.26', 'Mozilla/5.0 Chrome/139']) {
    assert.equal(isLineEntryBrowser(ua, false), false)
  }
  assert.equal(isLineEntryBrowser('Mozilla/5.0 Line/15.0.0', false), true)
  assert.equal(isLineEntryBrowser('custom', true), true)
})

function serverSteps(overrides = {}) {
  const calls = []
  return { calls, deps: {
    verify: async () => { calls.push('verify'); return lineId },
    findProfile: async id => { assert.equal(id, lineId); calls.push('lookup'); return 'existing-id' },
    issueSession: async id => { assert.equal(id, 'existing-id'); calls.push('session'); return tokenPair },
    ...overrides,
  } }
}
test('server validates identity before looking up and issuing an existing member session', async () => {
  const { calls, deps } = serverSteps()
  assert.deepEqual(await recogniseExistingLineMember('id-token', deps), { recognised: true, ...tokenPair })
  assert.deepEqual(calls, ['verify', 'lookup', 'session'])
})
test('unknown LINE account cannot create, link or receive a session', async () => {
  const { calls, deps } = serverSteps({ findProfile: async () => null })
  assert.deepEqual(await recogniseExistingLineMember('id-token', deps), { recognised: false })
  assert.deepEqual(calls, ['verify'])
})
test('invalid/expired/wrong-channel token cannot reach the member lookup', async () => {
  const { calls, deps } = serverSteps({ verify: async () => null })
  assert.deepEqual(await recogniseExistingLineMember('invalid-token', deps), { recognised: false })
  assert.deepEqual(calls, [])
})
test('missing, oversized or malformed token inputs fail closed', async () => {
  const { calls, deps } = serverSteps()
  for (const input of [null, undefined, {}, '', 'x'.repeat(16_385)]) {
    assert.deepEqual(await recogniseExistingLineMember(input, deps), { recognised: false })
  }
  assert.deepEqual(calls, [])
})
test('ambiguous/error lookup cannot issue a session', async () => {
  const { calls, deps } = serverSteps({ findProfile: async () => { throw new Error('duplicate identity') } })
  await assert.rejects(recogniseExistingLineMember('id-token', deps))
  assert.deepEqual(calls, ['verify'])
})
test('passive gate wiring excludes previous-login suppression, visibility retries and blocking overlay', () => {
  const gate = readFileSync(new URL('../src/foundation/line/LineEntryGate.tsx', import.meta.url), 'utf8')
  const adapter = readFileSync(new URL('../src/lib/line/lineInAppConnect.ts', import.meta.url), 'utf8')
  const endpoint = readFileSync(new URL('../supabase/functions/line-liff-recognize/index.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(gate, /hadPreviousLogin|visibilitychange|setWorking/)
  assert.doesNotMatch(adapter, /signInWithLine|lineLoginRedirect|startLineLogin/)
  assert.match(adapter, /if \(!recognition\)/)
  assert.match(adapter, /invoke\('line-liff-recognize'/)
  assert.doesNotMatch(endpoint, /createUser|upsert|user_metadata|updateUserById/)
})
