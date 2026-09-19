/**
 * Gesture score — finger count detection + camera engine.
 * Count extended digits (any finger). 1 → team1, 2 → team2, 3 → undo, 4 → reset.
 */

import { FilesetResolver, HandLandmarker, type GestureRecognizer, type Landmark, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { thumbDecisionFromResult } from './gestureThumbDetect'
import { createThumbRecognizer } from './gestureThumbRecognizer'
import {
  clearGestureScoreCameraCache,
  requestGestureScoreCamera,
  takeGestureScoreCameraRequest,
} from './gestureScoreCamera'

export type FingerAction = 'team1' | 'team2' | 'undo'
export type FingerScoreAction = FingerAction | 'reset'

export type HoldUi = {
  activeHold: FingerAction | null
  holdProgress: number
  gestureCooldown: boolean
}

export type EngineStatus = 'idle' | 'loading' | 'running' | 'unsupported' | 'error'

const WASM =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** Min time the same pose must be held once detection is stable. */
export const GESTURE_HOLD_MS = 100
/** Block repeat fires after a score (manual tap or camera). */
export const GESTURE_COOLDOWN_MS = 200
/** Accumulated evidence that the previous gesture ended, not a special reset pose. */
export const GESTURE_RELEASE_MS = 300
/** Ignore long pauses, without locking out cameras running below 7 FPS. */
const RELEASE_SAMPLE_GAP_MS = 1000
/** Keep hold progress when the camera briefly loses the hand between frames. */
const DROP_GRACE_MS = 400
/** Consecutive frames with the same finger count before hold timer counts. */
const STABLE_FRAMES = 2

const DIGITS = [
  { tip: 8, pip: 6, mcp: 5 },
  { tip: 12, pip: 10, mcp: 9 },
  { tip: 16, pip: 14, mcp: 13 },
  { tip: 20, pip: 18, mcp: 17 },
] as const

type HoldState = {
  held: FingerScoreAction | null
  heldSince: number | null
  lastDetectedAt: number | null
  stableFrames: number
  cooldownUntil: number
  awaitingRelease: boolean
  releaseEvidenceMs: number
  releaseSamples: number
  releaseLastSeenAt: number | null
  canChangeAction: boolean
  lastFired: FingerScoreAction | null
}

function dist3(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))
}

function digitExtended(
  norm: NormalizedLandmark[],
  world: Landmark[] | undefined,
  tip: number,
  pip: number,
  mcp: number,
): boolean {
  if (world?.length) {
    const wrist = world[0]
    const tipLm = world[tip]
    const pipLm = world[pip]
    const mcpLm = world[mcp]
    if (!wrist || !tipLm || !pipLm || !mcpLm) return false
    const tipDist = dist3(tipLm, wrist)
    return tipDist > dist3(pipLm, wrist) * 1.03 && tipDist > dist3(mcpLm, wrist) * 1.01
  }
  const wrist = norm[0]
  const tipLm = norm[tip]
  const pipLm = norm[pip]
  if (!wrist || !tipLm || !pipLm) return false
  const tipDist = Math.hypot(tipLm.x - wrist.x, tipLm.y - wrist.y)
  const pipDist = Math.hypot(pipLm.x - wrist.x, pipLm.y - wrist.y)
  return tipDist > pipDist * 1.06
}

/** How many digits are up — any finger, same rule for all four. */
export function extendedFingerCount(
  landmarks: NormalizedLandmark[] | undefined,
  worldLandmarks?: Landmark[] | undefined,
): number {
  if (!landmarks?.length) return 0
  const world = worldLandmarks?.length ? worldLandmarks : undefined
  return DIGITS.filter(({ tip, pip, mcp }) => digitExtended(landmarks, world, tip, pip, mcp)).length
}

export function fingerActionFromCount(count: number): FingerScoreAction | null {
  if (count === 1) return 'team1'
  if (count === 2) return 'team2'
  if (count === 3) return 'undo'
  if (count === 4) return 'reset'
  return null
}

export function fingerActionFromLandmarks(
  landmarks: NormalizedLandmark[] | undefined,
  worldLandmarks?: Landmark[] | undefined,
): FingerScoreAction | null {
  return fingerActionFromCount(extendedFingerCount(landmarks, worldLandmarks))
}

export function asFingerAction(action: FingerScoreAction | null): FingerAction | null {
  if (action === 'team1' || action === 'team2' || action === 'undo') return action
  return null
}

function pickHand<T>(hands: T[][] | undefined): T[] | undefined {
  if (!hands?.length) return undefined
  return hands.find((hand) => hand.length > 0)
}

function emptyHold(): HoldState {
  return {
    held: null,
    heldSince: null,
    lastDetectedAt: null,
    stableFrames: 0,
    cooldownUntil: 0,
    awaitingRelease: false,
    releaseEvidenceMs: 0,
    releaseSamples: 0,
    releaseLastSeenAt: null,
    canChangeAction: false,
    lastFired: null,
  }
}

/** 0→1 over stabilize-then-hold; reaches 1 only when a score would fire. */
function holdProgress(heldSince: number | null, stableFrames: number, now: number, holdMs = GESTURE_HOLD_MS): number {
  if (heldSince == null || stableFrames < 1) return 0
  const stabilize = Math.min(1, stableFrames / STABLE_FRAMES) * 0.28
  const hold = Math.min(1, (now - heldSince) / holdMs) * 0.72
  return Math.min(1, stabilize + hold)
}

export function gestureHoldHint(progress: number): string {
  if (progress < 0.28) return 'Hold pose…'
  if (progress < 0.82) return 'Keep holding…'
  return 'Almost ready…'
}

function afterFireState(state: HoldState, action: FingerScoreAction, now: number): HoldState {
  return {
    ...state,
    held: null,
    heldSince: null,
    lastDetectedAt: null,
    stableFrames: 0,
    lastFired: action,
    cooldownUntil: now + GESTURE_COOLDOWN_MS,
    awaitingRelease: true,
    releaseEvidenceMs: 0,
    releaseSamples: 0,
    releaseLastSeenAt: null,
    canChangeAction: true,
  }
}

function stepHold(
  state: HoldState,
  detected: FingerScoreAction | null,
  now: number,
  preview: boolean,
  releaseDetected: boolean,
  allowDirectionChange: boolean,
): { state: HoldState; ui: HoldUi; fire: FingerScoreAction | null } {
  // All scoring gestures, including peace-sign Undo, share the same timing.
  const holdMs = GESTURE_HOLD_MS
  if (preview) {
    return {
      state: { ...emptyHold(), cooldownUntil: state.cooldownUntil },
      ui: {
        activeHold: asFingerAction(detected),
        holdProgress: 0,
        gestureCooldown: false,
      },
      fire: null,
    }
  }

  const uiFrom = (s: HoldState, hold: FingerAction | null, progress: number): HoldUi => ({
    activeHold: hold,
    holdProgress: progress,
    gestureCooldown: now < s.cooldownUntil,
  })

  if (state.awaitingRelease) {
    if (allowDirectionChange && state.canChangeAction && detected && detected !== state.lastFired
      && now >= state.cooldownUntil) {
      const same = state.held === detected && state.lastDetectedAt != null
        && now - state.lastDetectedAt <= RELEASE_SAMPLE_GAP_MS
      const heldSince = same ? state.heldSince ?? now : now
      const stableFrames = same ? state.stableFrames + 1 : 1
      const candidate = { ...state, held: detected, heldSince, stableFrames, lastDetectedAt: now,
        releaseEvidenceMs: 0, releaseSamples: 0, releaseLastSeenAt: now }
      if (stableFrames >= STABLE_FRAMES && now - heldSince >= holdMs) {
        const fired = afterFireState(candidate, detected, now)
        return { state: fired, ui: uiFrom(fired, null, 0), fire: detected }
      }
      return { state: candidate, ui: uiFrom(candidate, asFingerAction(detected), holdProgress(heldSince, stableFrames, now, holdMs)), fire: null }
    }
    const continuous = state.releaseLastSeenAt != null
      && now - state.releaseLastSeenAt <= RELEASE_SAMPLE_GAP_MS
    const elapsed = continuous ? now - state.releaseLastSeenAt! : 0
    const priorEvidence = continuous ? state.releaseEvidenceMs : 0
    const absent = releaseDetected && !detected
    // Accumulate absence and tolerate occasional contrary frames. A sustained
    // thumb drains evidence faster than isolated dropouts can accumulate it.
    const releaseEvidenceMs = absent ? priorEvidence + elapsed : Math.max(0, priorEvidence - elapsed * 2)
    const releaseSamples = absent ? (continuous ? state.releaseSamples : 0) + 1
      : releaseEvidenceMs > 0 ? Math.max(0, state.releaseSamples - 1) : 0
    const released = releaseEvidenceMs >= GESTURE_RELEASE_MS && releaseSamples >= 3
    const next = {
      ...state,
      awaitingRelease: !released,
      releaseEvidenceMs: released ? 0 : releaseEvidenceMs,
      releaseSamples: released ? 0 : releaseSamples,
      releaseLastSeenAt: released ? null : now,
      held: null,
      heldSince: null,
      stableFrames: 0,
      lastDetectedAt: null,
    }
    return { state: next, ui: uiFrom(next, null, 0), fire: null }
  }

  if (!detected) {
    if (allowDirectionChange && releaseDetected && state.lastDetectedAt != null
      && now - state.lastDetectedAt >= GESTURE_HOLD_MS) {
      // Tolerate a brief missed frame, but do not combine separate flashes
      // across a sustained non-thumb interval into a new score.
      const cleared = { ...state, held: null, heldSince: null, lastDetectedAt: null, stableFrames: 0 }
      return { state: cleared, ui: uiFrom(cleared, null, 0), fire: null }
    }
    if (
      state.held &&
      state.lastDetectedAt != null &&
      now - state.lastDetectedAt < DROP_GRACE_MS
    ) {
      return {
        state,
        ui: uiFrom(state, asFingerAction(state.held), holdProgress(state.heldSince, state.stableFrames, now, holdMs)),
        fire: null,
      }
    }
    const cleared = { ...state, held: null, heldSince: null, lastDetectedAt: null, stableFrames: 0 }
    return {
      state: cleared,
      ui: uiFrom(cleared, null, 0),
      fire: null,
    }
  }

  if (now < state.cooldownUntil) {
    const blocked = { ...state, held: null, heldSince: null, stableFrames: 0 }
    return { state: blocked, ui: uiFrom(blocked, null, 0), fire: null }
  }

  if (state.held !== detected) {
    const started = {
      ...state,
      held: detected,
      heldSince: now,
      lastDetectedAt: now,
      stableFrames: 1,
    }
    return {
      state: started,
      ui: uiFrom(started, asFingerAction(detected), 0),
      fire: null,
    }
  }

  const stableFrames = state.stableFrames + 1
  const heldSince = state.heldSince ?? now
  const heldFor = now - heldSince
  const progress = holdProgress(heldSince, stableFrames, now, holdMs)
  const nextState: HoldState = {
    ...state,
    heldSince,
    lastDetectedAt: now,
    stableFrames,
  }

  if (stableFrames >= STABLE_FRAMES && heldFor >= holdMs) {
    const fired = afterFireState(nextState, detected, now)
    return {
      state: fired,
      ui: uiFrom(fired, null, 0),
      fire: detected,
    }
  }

  return { state: nextState, ui: uiFrom(nextState, asFingerAction(detected), progress), fire: null }
}

export function gestureScoreBeep(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 720
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.09)
    window.setTimeout(() => void ctx.close(), 160)
  } catch {
    /* audio optional */
  }
}

export type GestureCameraEngineConfig = {
  video: HTMLVideoElement
  /** Optional input crop only; classifier, fresh-frame gate and score latch stay shared. */
  prepareThumbFrame?: (video: HTMLVideoElement) => HTMLVideoElement | HTMLCanvasElement
  /** Experimental practice input; live courts retain their existing finger mapping. */
  gestureMode?: 'fingers' | 'thumbs'
  preview?: boolean
  onFire: (action: FingerScoreAction) => void
  onHoldUi?: (ui: HoldUi) => void
  onStatus?: (status: EngineStatus) => void
  onError?: (message: string) => void
}

/** Camera + hand landmarker + finger count + hold. Pages wire onFire only. */
export class GestureCameraEngine {
  private landmarker: HandLandmarker | null = null
  private thumbRecognizer: GestureRecognizer | null = null
  private stream: MediaStream | null = null
  private frameId: number | null = null
  private runId = 0
  private frameTs = 0
  private lastThumbVideoTime = -1
  private hold = emptyHold()
  private lastUi: HoldUi | null = null
  private config: GestureCameraEngineConfig

  constructor(config: GestureCameraEngineConfig) {
    this.config = config
  }

  updateConfig(patch: Partial<GestureCameraEngineConfig>): void {
    this.config = { ...this.config, ...patch }
  }

  resetHoldTracking(): void {
    this.hold = { ...this.hold, held: null, heldSince: null, stableFrames: 0, lastDetectedAt: null, releaseEvidenceMs: 0, releaseSamples: 0, releaseLastSeenAt: null }
  }

  markScoreCommitted(now = performance.now(), action?: FingerScoreAction): void {
    const fired = action ?? this.hold.lastFired
    if (!fired) return
    const canChangeAction = this.hold.awaitingRelease && this.hold.lastFired === fired && this.hold.canChangeAction
    this.hold = { ...afterFireState(this.hold, fired, now), canChangeAction }
  }

  markScoreBlocked(now = performance.now()): void {
    this.hold = { ...this.hold, held: null, heldSince: null, stableFrames: 0, cooldownUntil: now + GESTURE_COOLDOWN_MS }
  }

  async restart(): Promise<void> {
    this.stop()
    await this.start()
  }

  async start(): Promise<void> {
    const runId = ++this.runId
    try {
      this.config.onStatus?.('loading')
      let stream = await (takeGestureScoreCameraRequest() ?? requestGestureScoreCamera())
      if (!stream.getVideoTracks().some((track) => track.readyState === 'live')) {
        stream.getTracks().forEach((track) => track.stop())
        clearGestureScoreCameraCache()
        stream = await requestGestureScoreCamera()
      }
      if (this.runId !== runId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      this.stream = stream
      const { video } = this.config
      video.srcObject = stream
      await video.play()
      if (this.runId !== runId) return

      const vision = await FilesetResolver.forVisionTasks(WASM)
      if (this.config.gestureMode === 'thumbs') {
        const recognizer = await createThumbRecognizer(vision)
        if (this.runId !== runId) {
          recognizer.close()
          return
        }
        this.thumbRecognizer = recognizer
      } else {
        const opts = { runningMode: 'VIDEO' as const, numHands: 1 }
        let landmarker: HandLandmarker
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
            ...opts,
          })
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
            ...opts,
          })
        }
        if (this.runId !== runId) {
          landmarker.close()
          return
        }
        this.landmarker = landmarker
      }
      this.config.onStatus?.('running')
      this.frameId = requestAnimationFrame(this.tick)
    } catch (e) {
      if (this.runId !== runId) return
      this.stop()
      this.config.onStatus?.('error')
      this.config.onError?.(e instanceof Error ? e.message : 'Camera setup failed')
    }
  }

  stop(): void {
    this.runId += 1
    if (this.frameId !== null) cancelAnimationFrame(this.frameId)
    this.frameId = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.config.video) this.config.video.srcObject = null
    clearGestureScoreCameraCache()
    this.landmarker?.close()
    this.landmarker = null
    this.thumbRecognizer?.close()
    this.thumbRecognizer = null
    this.frameTs = 0
    this.lastThumbVideoTime = -1
    this.hold = emptyHold()
    this.lastUi = null
    this.config.onStatus?.('idle')
  }

  resumeVideo(): void {
    if (this.config.video.srcObject) void this.config.video.play().catch(() => {})
  }

  private tick = (): void => {
    const { video, preview, onFire, onHoldUi } = this.config
    const landmarker = this.landmarker
    const thumbRecognizer = this.thumbRecognizer
    if ((!landmarker && !thumbRecognizer) || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.frameId = requestAnimationFrame(this.tick)
      return
    }

    // Do not run the heavier classifier repeatedly on the same video frame.
    // Display refresh and the legacy finger path are unchanged.
    if (thumbRecognizer) {
      if (video.currentTime === this.lastThumbVideoTime) {
        this.frameId = requestAnimationFrame(this.tick)
        return
      }
      this.lastThumbVideoTime = video.currentTime
    }

    const now = performance.now()
    this.frameTs = now <= this.frameTs ? this.frameTs + 1 : now

    let detected: FingerScoreAction | null = null
    let releaseDetected = false
    try {
      if (thumbRecognizer) {
        const input = this.config.prepareThumbFrame?.(video) ?? video
        const result = thumbDecisionFromResult(thumbRecognizer.recognizeForVideo(input, this.frameTs))
        detected = result.action
        releaseDetected = result.releaseDetected
      } else if (landmarker) {
        const result = landmarker.detectForVideo(video, this.frameTs)
        const landmarks = pickHand(result.landmarks)
        detected = fingerActionFromLandmarks(landmarks, pickHand(result.worldLandmarks))
        releaseDetected = !landmarks?.length || detected === null
      }
    } catch {
      this.hold = { ...this.hold, releaseEvidenceMs: 0, releaseSamples: 0, releaseLastSeenAt: null }
      this.frameId = requestAnimationFrame(this.tick)
      return
    }

    const step = stepHold(this.hold, detected, now, Boolean(preview), releaseDetected, Boolean(thumbRecognizer))
    this.hold = step.state
    if (onHoldUi) {
      const ui = step.ui
      const prev = this.lastUi
      if (
        !prev ||
        prev.activeHold !== ui.activeHold ||
        prev.gestureCooldown !== ui.gestureCooldown ||
        Math.abs(prev.holdProgress - ui.holdProgress) > 0.008
      ) {
        this.lastUi = ui
        onHoldUi(ui)
      }
    }
    if (step.fire) onFire(step.fire)
    this.frameId = requestAnimationFrame(this.tick)
  }
}

/** @deprecated use gestureScoreBeep */
export const gestureCameraBeep = gestureScoreBeep

/** @deprecated use FingerScoreAction */
export type GestureCameraAction = FingerScoreAction

/** @deprecated use HoldUi */
export type HoldUiSnapshot = HoldUi
