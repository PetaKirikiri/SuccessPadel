import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { englishEntry, englishLoginCallback, englishTicketUrl, ENGLISH_HOTEL, SHARED_LIFF_ID } from '../src/lib/line/englishEntry'
import { englishHandshake } from '../src/lib/line/englishHandshake'

const signup = { signup: true, attempted: false }
const signin = { signup: false, attempted: false }
const query = '?app=englishsuccess&mode=hotel&intent=signup'
assert.deepEqual(englishEntry(query), signup)
assert.deepEqual(englishEntry('?liff.state=' + encodeURIComponent(query)), signup)
assert.deepEqual(englishEntry('?liff.state=' + encodeURIComponent('/login' + query)), signup)
assert.deepEqual(englishEntry(new URL(englishLoginCallback(true)).search), { signup: true, attempted: true })
for (const search of ['', '?app=other&mode=hotel', '?app=englishsuccess', '?lpl=claim', `${query}&lpl=claim`, `${query}&sp_return_to=/friendly`]) {
  assert.equal(englishEntry(search), null)
}
assert.equal(englishTicketUrl('one-use'), `${ENGLISH_HOTEL}#ticket=one-use`)
assert.equal(new URL(englishTicketUrl('secret')).search, '')

function setup(results: Record<string, unknown>[]) {
  const calls: string[] = []
  const logins: string[] = []
  const line = {
    init: async (config: { liffId: string; withLoginOnExternalBrowser: boolean }) => {
      assert.equal(config.liffId, SHARED_LIFF_ID)
      assert.equal(config.withLoginOnExternalBrowser, false)
      calls.push('init')
    },
    isLoggedIn: () => true,
    getIDToken: (): string | null => 'server-verifies-this',
    getAccessToken: () => 'line-access',
    login: ({ redirectUri }: { redirectUri: string }) => { logins.push(redirectUri) },
  }
  const invoke = async (name: string, body: Record<string, unknown>, signal: AbortSignal) => {
    assert.equal(signal.aborted, false)
    assert.equal(body.id_token, 'server-verifies-this')
    if (name === 'line-liff-auth') assert.equal(body.access_token, 'line-access')
    else assert.equal(body.handoff, true)
    calls.push(name)
    const result = results.shift()
    assert.ok(result, 'Unexpected account request')
    return result
  }
  return { calls, logins, line, invoke }
}

for (const entry of [signin, signup]) {
  const test = setup([{ recognised: true, ticket: 'existing' }])
  assert.equal(await englishHandshake(entry, test.line, test.invoke), `${ENGLISH_HOTEL}#ticket=existing`)
  assert.deepEqual(test.calls, ['init', 'line-liff-recognize'])
}
{
  const test = setup([{ recognised: false }, { access_token: 'discarded', refresh_token: 'discarded' }, { recognised: true, ticket: 'new-member' }])
  assert.equal(await englishHandshake(signup, test.line, test.invoke), `${ENGLISH_HOTEL}#ticket=new-member`)
  assert.deepEqual(test.calls, ['init', 'line-liff-recognize', 'line-liff-auth', 'line-liff-recognize'])
}
{
  const test = setup([{ recognised: false }])
  assert.equal(await englishHandshake(signin, test.line, test.invoke), `${ENGLISH_HOTEL}?line_result=new`)
  assert.deepEqual(test.calls, ['init', 'line-liff-recognize'])
}
for (const entry of [signin, signup]) {
  const test = setup([])
  test.line.isLoggedIn = () => false
  assert.equal(await englishHandshake(entry, test.line, test.invoke), null)
  assert.deepEqual(test.calls, ['init'])
  assert.equal(test.logins.length, 1)
  const callback = new URL(test.logins[0])
  assert.equal(callback.origin, 'https://success-padel-ffzt.vercel.app')
  assert.equal(callback.pathname, '/login')
  assert.deepEqual(englishEntry(callback.search), { ...entry, attempted: true })
  await assert.rejects(englishHandshake({ ...entry, attempted: true }, test.line, test.invoke), /approval was not completed/)
  assert.equal(test.logins.length, 1)
}
{
  const test = setup([])
  test.line.init = async () => { throw new Error('Consent denied') }
  await assert.rejects(englishHandshake(signup, test.line, test.invoke), /Consent denied/)
  assert.deepEqual(test.calls, [])
}
{
  const test = setup([])
  test.line.getIDToken = () => null
  await assert.rejects(englishHandshake(signup, test.line, test.invoke), /identity/)
  assert.deepEqual(test.calls, ['init'])
}
for (const results of [[{ error: 'offline' }], [{ recognised: true }], [{ recognised: false }, {}]]) {
  const test = setup(results)
  await assert.rejects(englishHandshake(signup, test.line, test.invoke))
}
{
  const test = setup([])
  let release!: () => void
  test.line.init = () => new Promise<void>(resolve => { release = resolve })
  await assert.rejects(englishHandshake(signup, test.line, test.invoke, 5), /too long/)
  release()
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.deepEqual(test.calls, [])
}
{
  const test = setup([])
  let release!: (value: Record<string, unknown>) => void
  let requestSignal!: AbortSignal
  const invoke = async (_name: string, _body: Record<string, unknown>, signal: AbortSignal) => {
    requestSignal = signal
    return new Promise<Record<string, unknown>>(resolve => { release = resolve })
  }
  await assert.rejects(englishHandshake(signup, test.line, invoke, 5), /too long/)
  assert.equal(requestSignal.aborted, true)
  release({ recognised: false })
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.deepEqual(test.calls, ['init'])
}
// Bootstrap boundary: Padel's providers never mount for the English entry.
const bootstrap = readFileSync('src/main.tsx', 'utf8')
assert.doesNotMatch(bootstrap, /import App from/)
assert.match(bootstrap, /if \(englishEntry\(window.location.search\)\)/)
assert.match(bootstrap, /else \{\s*void import\('\.\/App.tsx'\)/)
const adapter = readFileSync('src/englishSuccessEntry.ts', 'utf8')
assert.match(adapter, /persistSession: false/)
assert.doesNotMatch(adapter, /getSession|setSession|supabaseClient|AuthProvider/)
console.log('English entry: new, existing, declined, timeout, redirect, isolation and Padel routing checks passed')
