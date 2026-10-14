import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sharePlayerProfile } from '../src/lib/playerProfileShare'

const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const payload = {
  url: 'https://successpadel.app/competitions/test-competition?view=leaderboard',
  title: 'Success Padel — Live scoreboard',
  text: 'Follow the live scores and standings at Success Padel.',
}
const mock = (value: object) => Object.defineProperty(globalThis, 'navigator', { configurable: true, value })
try {
  let received: unknown
  mock({ share: async (data: unknown) => { received = data } })
  assert.equal(await sharePlayerProfile(payload), 'shared')
  assert.deepEqual(received, payload)

  let copied = ''
  mock({ clipboard: { writeText: async (url: string) => { copied = url } } })
  assert.equal(await sharePlayerProfile(payload), 'copied')
  assert.equal(copied, payload.url)

  copied = ''
  mock({
    share: async () => { throw new DOMException('Cancelled', 'AbortError') },
    clipboard: { writeText: async (url: string) => { copied = url } },
  })
  assert.equal(await sharePlayerProfile(payload), 'cancelled')
  assert.equal(copied, '')

  mock({ clipboard: { writeText: async () => { throw new Error('Denied') } } })
  assert.equal(await sharePlayerProfile(payload), 'failed')

  const header = readFileSync('src/components/GameCard/GameCardHeader.tsx', 'utf8')
  assert.match(header, /sharePlayerProfile\(\{\s*url,/)
  assert.match(header, /aria-label=.*Share live scoreboard/)
  assert.match(header, /disabled=\{sharing\}/)
  console.log('Scoreboard share: native payload, copied live link, cancellation and failure passed')
} finally {
  if (original) Object.defineProperty(globalThis, 'navigator', original)
  else Reflect.deleteProperty(globalThis, 'navigator')
}
