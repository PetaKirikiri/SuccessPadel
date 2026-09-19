import assert from 'node:assert/strict'
import './test-thumb-surface.mts'
import { thumbDecisionFromResult } from '../src/lib/gestureThumbDetect'
import { GestureCameraEngine, fingerActionFromLandmarks, type FingerScoreAction } from '../src/lib/gestureFingerDetect'
import { recognitionCrop, prepareRecognitionFrame } from '../src/lib/gestureRecognitionZoom'

assert.deepEqual(recognitionCrop(1920, 1080, 2), { x: 480, y: 270, width: 960, height: 540 })
assert.deepEqual(recognitionCrop(1920, 1080, 1.5), { x: 320, y: 180, width: 1280, height: 720 })
assert.deepEqual(recognitionCrop(1080, 1920, 2), { x: 270, y: 480, width: 540, height: 960 })
const cropVideo = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement
const draws: unknown[][] = []
const cropCanvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args: unknown[]) => draws.push(args) }) } as unknown as HTMLCanvasElement
assert.equal(prepareRecognitionFrame(cropVideo, cropCanvas, 1), cropVideo, '1x preserves original video input')
assert.equal(draws.length, 0)
assert.equal(prepareRecognitionFrame(cropVideo, cropCanvas, 2), cropCanvas, 'The preview canvas is the actual recognizer input')
assert.deepEqual(draws[0], [cropVideo, 480, 270, 960, 540, 0, 0, 960, 540])
assert.equal(cropCanvas.width, 960)
assert.equal(cropCanvas.height, 540)
assert.throws(() => prepareRecognitionFrame(cropVideo, null, 2), /not ready/, 'Never silently recognise outside the chosen crop')

type Point = { x: number; y: number; z: number }
const up: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.6, z: 0 }))
up[0] = { x: 0.52, y: 0.78, z: 0 }
for (const [i, x] of [[5, 0.44], [9, 0.51], [13, 0.58], [17, 0.65]]) {
  up[i] = { x, y: 0.5, z: 0 }
  up[i + 1] = { x: x + 0.025, y: 0.42, z: 0 }
  up[i + 3] = { x, y: 0.58, z: 0 }
}
const down = structuredClone(up)
const fist = structuredClone(up)
const peace = structuredClone(up)
const unrecognisedHand = structuredClone(up)
const category = (categoryName: string, score = 0.95) => ({ categoryName, score, index: -1, displayName: '' })
const result = (name: string, score = 0.95) => ({ landmarks: [up], gestures: [[category(name, score)]] })
for (const [name, expected] of [['Thumb_Up', 'team1'], ['Thumb_Down', 'team2']] as const) {
  assert.deepEqual(thumbDecisionFromResult(result(name)), { action: expected, releaseDetected: false })
  for (const confidence of [0.65, 0.8]) {
    assert.deepEqual(thumbDecisionFromResult(result(name, confidence)), { action: expected, releaseDetected: false })
  }
  for (const confidence of [0.4, 0.5, 0.649]) {
    assert.deepEqual(thumbDecisionFromResult(result(name, confidence)), { action: null, releaseDetected: false })
  }
}
for (const name of ['Closed_Fist', 'Open_Palm']) {
  assert.deepEqual(thumbDecisionFromResult(result(name)), { action: null, releaseDetected: true })
  assert.deepEqual(thumbDecisionFromResult(result(name, 0.6)), { action: null, releaseDetected: true })
}
assert.deepEqual(thumbDecisionFromResult(result('Victory', 0.65)), { action: 'undo', releaseDetected: false })
assert.deepEqual(thumbDecisionFromResult(result('Victory', 0.649)), { action: null, releaseDetected: false })
for (const name of ['None', 'Pointing_Up', 'ILoveYou', 'Unknown']) {
  assert.deepEqual(thumbDecisionFromResult(result(name)), { action: null, releaseDetected: true })
}
assert.deepEqual(thumbDecisionFromResult({ landmarks: [], gestures: [] }), { action: null, releaseDetected: true })
assert.deepEqual(thumbDecisionFromResult({ landmarks: [up], gestures: [] }), { action: null, releaseDetected: false })
assert.equal(thumbDecisionFromResult(result('Thumb_Up', NaN)).action, null)
assert.equal(thumbDecisionFromResult({ landmarks: [up, down], gestures: [[category('Thumb_Up')], [category('Thumb_Down')]] }).action, null)
assert.equal(thumbDecisionFromResult({ landmarks: [up], gestures: [[category('Thumb_Up', 0.7), category('None', 0.9)]] }).action, null)

// Exercise the actual engine callback and hold/release behaviour with synthetic
// camera landmarks. No camera request, network call or score persistence.
let now = 0
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } })
Object.assign(globalThis, { requestAnimationFrame: () => 1, HTMLMediaElement: { HAVE_CURRENT_DATA: 2 } })
function harness(gestureMode?: 'thumbs' | 'fingers') {
  const video = { readyState: 2, videoWidth: 100, videoHeight: 100, currentTime: 0 } as HTMLVideoElement
  let pose: Point[] | undefined
  let throws = false
  const fired: FingerScoreAction[] = []
  const engine = new GestureCameraEngine({ video, gestureMode, onFire: a => {
    fired.push(a)
    engine.markScoreCommitted(now, a)
  } })
  const recognizerInputs: unknown[] = []
  const internals = engine as unknown as { tick: () => void; landmarker: unknown; thumbRecognizer: unknown }
  internals.landmarker = { detectForVideo: () => {
    if (throws) throw new Error('Camera inference interrupted')
    return { landmarks: pose ? [pose] : [], worldLandmarks: [] }
  } }
  if (gestureMode === 'thumbs') {
    internals.landmarker = null
    internals.thumbRecognizer = { recognizeForVideo: (input: unknown) => {
      recognizerInputs.push(input)
      if (throws) throw new Error('Camera inference interrupted')
      if (!pose) return { landmarks: [], gestures: [] }
      return result(pose === up ? 'Thumb_Up' : pose === down ? 'Thumb_Down' : pose === peace ? 'Victory' : pose === fist ? 'Closed_Fist' : 'None')
    } }
  }
  const frame = (time: number, points?: Point[], error = false, newVideoFrame = true) => {
    now = time; pose = points; throws = error
    if (newVideoFrame) video.currentTime = time / 1000
    internals.tick()
  }
  const release = (start: number, points?: Point[]) => {
    for (let t = start; t <= start + 400; t += 50) frame(t, points)
  }
  return { engine, fired, frame, release, recognizerInputs }
}

for (const fps of [4, 15, 30, 60]) {
  const undo = harness('thumbs')
  for (let f = 0; f <= fps * 4; f++) {
    const t = f * 1000 / fps
    undo.frame(t, peace)
    if (t < 100) assert.equal(undo.fired.length, 0, 'Peace shares the 100 ms thumb hold')
    if (t >= 100) assert.equal(undo.fired.length, 1, 'Peace fires as soon as the thumb hold is met')
  }
  assert.deepEqual(undo.fired, ['undo'], 'Holding peace must undo only once')
  undo.release(4100)
  for (let t = 4600; t <= 5400; t += 50) undo.frame(t, peace)
  assert.deepEqual(undo.fired, ['undo', 'undo'], 'Removing and remaking peace allows a new Undo')
  undo.frame(5700, up); undo.frame(5820, up)
  assert.deepEqual(undo.fired, ['undo', 'undo', 'team1'], 'Thumbs still work immediately after Undo')
}
const afterThumb = harness('thumbs')
afterThumb.frame(0, up); afterThumb.frame(120, up)
afterThumb.frame(400, peace); afterThumb.frame(450, peace)
assert.deepEqual(afterThumb.fired, ['team1'], 'Peace still needs a stable 100 ms hold')
afterThumb.frame(500, peace)
assert.deepEqual(afterThumb.fired, ['team1', 'undo'], 'No special reset pose before Undo')
for (let f = 0; f < 90; f++) afterThumb.frame(1200 + f * 1000 / 30, f % 9 === 8 ? undefined : peace)
assert.deepEqual(afterThumb.fired, ['team1', 'undo'], 'Brief tracking dropouts cannot repeat Undo')
const shortPeace = harness('thumbs')
shortPeace.frame(0, peace); shortPeace.frame(50, peace)
shortPeace.release(250)
shortPeace.frame(800, peace); shortPeace.frame(850, peace)
assert.deepEqual(shortPeace.fired, [], 'Separate brief peace signs cannot combine into Undo')
const undoPreview = harness('thumbs')
undoPreview.engine.updateConfig({ preview: true })
for (let t = 0; t <= 2000; t += 50) undoPreview.frame(t, peace)
assert.deepEqual(undoPreview.fired, [], 'Preview must not undo')

const zoomed = harness('thumbs')
zoomed.frame(0, up); zoomed.frame(120, up)
zoomed.engine.updateConfig({ prepareThumbFrame: () => cropCanvas })
zoomed.frame(300, up); zoomed.frame(450, up)
assert.equal(zoomed.recognizerInputs.at(-1), cropCanvas)
assert.deepEqual(zoomed.fired, ['team1'], 'Zoom must not reset a held gesture and double-score')
zoomed.release(500)
zoomed.frame(1000, up); zoomed.frame(1120, up)
assert.deepEqual(zoomed.fired, ['team1', 'team1'], 'New gestures still score with cropped input')

const thumb = harness('thumbs')
thumb.frame(0, up); thumb.frame(60, up)
assert.deepEqual(thumb.fired, [])
thumb.frame(120, up); thumb.frame(500, up); thumb.frame(900, up)
assert.deepEqual(thumb.fired, ['team1'])
thumb.frame(1000); thumb.frame(1100, up); thumb.frame(1220, up)
assert.equal(thumb.fired.length, 1, 'one missed frame must not re-arm')
thumb.frame(1500, down); thumb.frame(1620, down)
assert.deepEqual(thumb.fired, ['team1', 'team2'], 'a sustained change of direction is a new gesture')
thumb.release(1700)
thumb.frame(2200, up); thumb.frame(2320, up)
assert.deepEqual(thumb.fired, ['team1', 'team2', 'team1'])
thumb.release(2400, fist)
thumb.frame(2900, down); thumb.frame(3020, down)
assert.deepEqual(thumb.fired, ['team1', 'team2', 'team1', 'team2'])
thumb.engine.updateConfig({ preview: true })
thumb.frame(3200, up); thumb.frame(3600, up)
assert.equal(thumb.fired.length, 4, 'preview must never score')

for (const fps of [15, 30, 60, 120]) {
  const noisy = harness('thumbs')
  for (let f = 0; f <= fps * 6; f++) noisy.frame(f * 1000 / fps, f > 0 && f % 9 === 0 ? undefined : up)
  assert.deepEqual(noisy.fired, ['team1'], `${fps} fps dropout sequence must only score once`)
}
const ambiguous = harness('thumbs')
ambiguous.frame(0, up); ambiguous.frame(120, up)
// Stopping the thumb while keeping the hand in view also ends the gesture.
for (let t = 200; t <= 3000; t += 50) ambiguous.frame(t, unrecognisedHand)
ambiguous.frame(3100, up); ambiguous.frame(3220, up)
assert.equal(ambiguous.fired.length, 2, 'no named reset pose is required')

const interrupted = harness('thumbs')
interrupted.frame(0, up); interrupted.frame(120, up)
interrupted.frame(300); interrupted.frame(3000)
interrupted.frame(3100, up); interrupted.frame(3220, up)
assert.equal(interrupted.fired.length, 1, 'camera stall must not count as release')
for (let t = 3300; t <= 3500; t += 50) interrupted.frame(t)
interrupted.frame(3550, undefined, true)
interrupted.frame(3600); interrupted.frame(3650)
interrupted.frame(3800, up); interrupted.frame(3920, up)
assert.equal(interrupted.fired.length, 1, 'inference errors interrupt release evidence')
interrupted.release(4000)
interrupted.frame(4500, up); interrupted.frame(4620, up)
assert.equal(interrupted.fired.length, 2)

for (const mode of [undefined, 'fingers'] as const) {
  for (const [count, expected] of [[1, 'team1'], [2, 'team2'], [3, 'undo'], [4, 'reset']] as const) {
    const pose = structuredClone(up)
    for (const mcp of [5, 9, 13, 17].slice(0, count)) pose[mcp + 3] = { ...pose[mcp], y: 0.12 }
    assert.equal(fingerActionFromLandmarks(pose), expected)
    const legacy = harness(mode)
    for (let f = 0; f <= 90; f++) legacy.frame(f * 1000 / 30, f > 0 && f % 9 === 0 ? undefined : pose)
    assert.deepEqual(legacy.fired, [expected], `legacy ${count}-finger gesture must not repeat`)
    legacy.release(3100)
    legacy.frame(3600, pose); legacy.frame(3720, pose)
    assert.deepEqual(legacy.fired, [expected, expected])
  }
}
for (const action of ['team1', 'team2', 'undo', 'reset'] as const) {
  const manual = harness('thumbs')
  manual.engine.markScoreCommitted(0, action)
  manual.frame(300, up); manual.frame(450, up)
  assert.equal(manual.fired.length, 0, 'manual score changes must also latch camera input')
  manual.release(500)
  manual.frame(1000, up); manual.frame(1120, up)
  assert.deepEqual(manual.fired, ['team1'])
}
// Both entry styles: form a thumb on camera, or bring one into view.
// Includes frame rates below the old 150 ms hard cutoff and sustained use.
for (const fps of [2, 4, 5, 6, 10, 15, 30, 60, 120]) {
  for (const between of [undefined, unrecognisedHand]) {
    const natural = harness('thumbs')
    const gap = 1000 / fps
    let t = 0
    for (let gesture = 0; gesture < 20; gesture++) {
      for (let f = 0; f < Math.max(3, fps); f++) { natural.frame(t, up); t += gap }
      assert.equal(natural.fired.length, gesture + 1, `${fps} fps gesture ${gesture + 1}`)
      for (let f = 0; f < Math.max(4, fps); f++) { natural.frame(t, between); t += gap }
    }
  }
}
const mixedNeutral = harness('thumbs')
mixedNeutral.frame(0, up); mixedNeutral.frame(120, up)
// A brief old-label flash while lowering the thumb must not require a perfect reset.
for (let f = 0; f < 45; f++) mixedNeutral.frame(200 + f * 1000 / 30, f % 9 === 8 ? up : unrecognisedHand)
mixedNeutral.frame(1800, up); mixedNeutral.frame(1920, up)
assert.deepEqual(mixedNeutral.fired, ['team1', 'team1'])

const directionGlitch = harness('thumbs')
directionGlitch.frame(0, up); directionGlitch.frame(120, up)
directionGlitch.frame(500, down); directionGlitch.frame(533, up); directionGlitch.frame(700, up)
assert.deepEqual(directionGlitch.fired, ['team1'], 'one wrong-direction frame is not a new gesture')
directionGlitch.frame(800, down); directionGlitch.frame(920, down)
directionGlitch.frame(1200, up); directionGlitch.frame(1320, up)
assert.deepEqual(directionGlitch.fired, ['team1', 'team2', 'team1'])

const stalledVideo = harness('thumbs')
stalledVideo.frame(0, up)
stalledVideo.frame(200, up, false, false)
assert.equal(stalledVideo.fired.length, 0, 'reprocessing a frozen frame must not complete a hold')
stalledVideo.frame(240, up)
assert.deepEqual(stalledVideo.fired, ['team1'])
console.log('PASS: natural on-camera and off-camera gestures; 20 repetitions at 2–120 fps; noisy absence; held-thumb and direction-glitch protection; fresh-frame processing; finger compatibility; manual controls; preview safety')
