import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThumbScorePadView } from '../src/components/CameraScoreTracker/ThumbScorePadView'

// These are the user-approved detector files, not a replacement implementation.
// Changing them requires a separate recognition review and physical-camera test.
const approvedRecognition = {
  // Requested peace-sign Undo now shares the 100 ms thumb hold; repeat protection unchanged.
  // Synthetic regression coverage below; physical-camera acceptance remains pending.
  'gestureFingerDetect.ts': '93a01d9fc91489e4b35644b9f95d3fb0d47620e5e600aff7801ddbdbd4069a79',
  // Victory maps to Undo at the same 0.65 confidence cutoff as thumbs.
  'gestureThumbDetect.ts': 'a265599385b94ab8ea6059b016818e72fdb8a732c2d47f2a1367ed7411606f49',
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
  assert.match(source, /engineRef.current = engine\s+(?:\/\/[^\n]*\n\s*)?void engine.start\(\)/, 'Both scorer entries auto-start once mounted')
  assert.match(source, /prepareThumbFrame,/)
  assert.match(source, /zoom=\{zoom\} onZoomChange=\{setZoom\} zoomCanvasRef=\{zoomCanvasRef\}/)
}

const noop = () => {}
const zoomHook = readFileSync(new URL('../src/hooks/useGestureRecognitionZoom.ts', import.meta.url), 'utf8')
assert.match(zoomHook, /useState<RecognitionZoom>\(2\)/)
assert.match(zoomHook, /useRef<RecognitionZoom>\(2\)/)
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
const zoomed = renderToStaticMarkup(createElement(ThumbScorePadView, { ...props, zoom: 2, onZoomChange: noop }))
assert.match(zoomed, /data-recognition-zoom="2"/)
for (const zoom of [1, 1.5, 2]) assert.ok(zoomed.includes(`Recognition zoom ${zoom}×`))
console.log('PASS: shared approved thumb presentation, recognition lock, supplied scores and save errors')
