import assert from 'node:assert/strict'
import { englishDestination, englishEntry, englishLoginCallback, englishTicketUrl } from '../src/lib/line/englishEntry'
import { englishHandshake } from '../src/lib/line/englishHandshake'

const entry = { signup: true, attempted: false, mode: 'padel-coach' as const }
const query = '?app=englishsuccess&mode=padel-coach&intent=signup'
assert.deepEqual(englishEntry(query), entry)
assert.deepEqual(englishEntry(`?liff.state=${encodeURIComponent(query)}`), entry)
assert.deepEqual(englishEntry(new URL(englishLoginCallback(true, entry.mode)).search), { ...entry, attempted: true })
for (const claim of ['lpl=claim','sp_return_to=/friendly']) assert.equal(englishEntry(`${query}&${claim}`), null)
assert.equal(englishEntry('?app=englishsuccess&mode=evil'), null)
assert.equal(englishTicketUrl('single-use', entry.mode), 'https://learn-english-coral.vercel.app/padel-coach#ticket=single-use')
const line = { init: async () => {}, isLoggedIn: () => true, getIDToken: () => 'server-verified', getAccessToken: () => 'line-access', login: () => {} }
for (const isNew of [false, true]) {
  const replies = isNew ? [{ recognised: false }, { access_token: 'discarded', refresh_token: 'discarded' }, { recognised: true, ticket: 'single-use' }] : [{ recognised: true, ticket: 'single-use' }]
  const calls: string[] = []
  assert.equal(await englishHandshake(entry, line, async name => { calls.push(name); return replies.shift()! }), englishTicketUrl('single-use', entry.mode))
  assert.deepEqual(calls, isNew ? ['line-liff-recognize','line-liff-auth','line-liff-recognize'] : ['line-liff-recognize'])
}
assert.equal(await englishHandshake({ ...entry, signup: false }, line, async () => ({ recognised: false })), `${englishDestination(entry.mode)}?line_result=new`)
console.log('Coach: existing/new accounts, fixed return route and player-claim isolation passed')
