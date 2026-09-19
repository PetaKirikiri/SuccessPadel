import assert from 'node:assert/strict'
import { thumbDecisionFromResult } from '../src/lib/gestureThumbDetect'
import { GestureCameraEngine, fingerActionFromLandmarks, type FingerScoreAction } from '../src/lib/gestureFingerDetect'

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
const unrecognisedHand = structuredClone(up)
const category = (categoryName: string, score = 0.95) => ({ categoryName, score, index: -1, displayName: '' })
const result = (name: string, score = 0.95) => ({ landmarks: [up], gestures: [[category(name, score)]] })
for (const [name, expected] of [['Thumb_Up', 'team1'], ['Thumb_Down', 'team2']] as const) {
  assert.deepEqual(thumbDecisionFromResult(result(name)), { action: expected, releaseDetected: false })
  assert.deepEqual(thumbDecisionFromResult(result(name, 0.5)), { action: null, releaseDetected: false })
}
for (const name of ['Closed_Fist', 'Open_Palm']) {
  assert.deepEqual(thumbDecisionFromResult(result(name)), { action: null, releaseDetected: true })
  assert.deepEqual(thumbDecisionFromResult(result(name, 0.6)), { action: null, releaseDetected: true })
}
for (const name of ['None', 'Victory', 'Pointing_Up', 'ILoveYou', 'Unknown']) {
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
  const internals = engine as unknown as { tick: () => void; landmarker: unknown; thumbRecognizer: unknown }
  internals.landmarker = { detectForVideo: () => {
    if (throws) throw new Error('Camera inference interrupted')
    return { landmarks: pose ? [pose] : [], worldLandmarks: [] }
  } }
  if (gestureMode === 'thumbs') {
    internals.landmarker = null
    internals.thumbRecognizer = { recognizeForVideo: () => {
      if (throws) throw new Error('Camera inference interrupted')
      if (!pose) return { landmarks: [], gestures: [] }
      return result(pose === up ? 'Thumb_Up' : pose === down ? 'Thumb_Down' : pose === fist ? 'Closed_Fist' : 'None')
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
  return { engine, fired, frame, release }
}

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
