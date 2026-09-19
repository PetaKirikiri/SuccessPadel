import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThumbScorePadView } from '../src/components/CameraScoreTracker/ThumbScorePadView'

// These are the user-approved detector files, not a replacement implementation.
// Changing them requires a separate recognition review and physical-camera test.
const approvedRecognition = {
  'gestureFingerDetect.ts': '9e71e4218c06ae9cf18200e0f34f37b4dc72d93a3042e751f1274ab1901a50e8',
  'gestureThumbDetect.ts': '8d78440ab6e2cc15f5bae84f748d681c72bd59478f253e94492fb6376ceed50e',
  'gestureThumbRecognizer.ts': 'cf8fb1d754f8c05f0e543c6e5276ab269480822617448301f61e1ecd5e65774b',
}
for (const [file, expected] of Object.entries(approvedRecognition)) {
  const source = readFileSync(new URL(`../src/lib/${file}`, import.meta.url))
  assert.equal(createHash('sha256').update(source).digest('hex'), expected,
    `Approved recognition changed: ${file}. Review camera behavior before updating this lock.`)
}
for (const file of ['CameraScoreTrackerPractice.tsx', 'CameraScoreTracker.logic.tsx']) {
  const source = readFileSync(new URL(`../src/components/CameraScoreTracker/${file}`, import.meta.url), 'utf8')
  assert.match(source, /import \{ ThumbScorePadView \} from '\.\/ThumbScorePadView'/)
  assert.match(source, /<ThumbScorePadView\s/)
  assert.doesNotMatch(source, /<CameraScoreTracker[\s>]/, 'Do not revive the older court presentation')
  assert.match(source, /gestureMode: 'thumbs'/)
  assert.match(source, /new GestureCameraEngine\(/)
}

const noop = () => {}
const props = {
  videoRef: { current: null }, status: 'idle' as const, error: null,
  ourPoints: 1, theirPoints: 2, ourGames: 3, theirGames: 4, timerValue: '12:34',
  onWin: noop, onLose: noop, onUndo: noop, restartCamera: noop, goBack: noop,
}
const linked = renderToStaticMarkup(createElement(ThumbScorePadView, props))
const practice = renderToStaticMarkup(createElement(ThumbScorePadView, { ...props, onReset: noop }))
const classes = (html: string) => [...html.matchAll(/class="([^"]*)"/g)].map(match => match[1])
assert.deepEqual(classes(linked), classes(practice), 'Linked and practice presentation must have identical geometry')
for (const label of ['Thumbs up — point for our team', 'Thumbs down — point for other team', 'Undo last score action', 'Back']) {
  assert.ok(linked.includes(`aria-label="${label}"`))
}
assert.ok(linked.includes('12:34'))
assert.match(linked, /disabled=""[^>]*aria-label="Reset score"/,
  'A linked court must not pretend to reset shared scores without a persistence operation')
assert.match(renderToStaticMarkup(createElement(ThumbScorePadView, { ...props, error: 'Save failed' })), /Save failed/)
console.log('PASS: shared approved thumb presentation, recognition lock, supplied scores and save errors')
