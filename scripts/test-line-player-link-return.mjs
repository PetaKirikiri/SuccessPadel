import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { lineHandoffCompleteUrl } from '../src/lib/line/playerLinkReturnUrls.ts'

test('LINE linking always hands off to the public app and preserves the token', () => {
  for (const token of ['handoff_test', 'token+with/special?chars=&']) {
    const url = new URL(lineHandoffCompleteUrl(token))
    assert.equal(url.origin, 'https://successpadel.app')
    assert.equal(url.pathname, '/auth/line/complete')
    assert.equal(url.searchParams.get('handoffToken'), token)
    assert.deepEqual([...url.searchParams.keys()], ['handoffToken'])
  }
})

test('both QR and OAuth linking use the canonical handoff before consuming its session', () => {
  const playerLink = fs.readFileSync('src/lib/line/playerLink.ts', 'utf8')
  const qr = fs.readFileSync('src/foundation/line/LinePlayerLinkEntryHandler.tsx', 'utf8')
  const oauth = fs.readFileSync('src/foundation/line/LineLinkReturnFlow.tsx', 'utf8')
  assert.ok(playerLink.includes('return lineHandoffCompleteUrl(handoffToken)'))
  assert.ok(playerLink.includes('${PLAYER_LINK_APP_ORIGIN}${PLAYER_LINK_HANDOFF_PATH}'))
  assert.ok(qr.includes('scheduleForceExternalOpen(scoreboardUrl)'))
  assert.ok(oauth.includes('!isNativeApp() && window.location.origin !== PLAYER_LINK_APP_ORIGIN'))
  const redirect = oauth.indexOf('window.location.replace(lineHandoffCompleteUrl(result.handoffToken))')
  const consume = oauth.indexOf('await consumeLineHandoffToken(')
  assert.ok(redirect > 0 && redirect < consume)
})
