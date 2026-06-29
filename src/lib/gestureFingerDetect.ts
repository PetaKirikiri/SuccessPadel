/**
 * Gesture score — finger count detection + camera engine.
 * Count extended digits (any finger). 1 → team1, 2 → team2, 3 → undo, 4 → reset.
 */

import { FilesetResolver, HandLandmarker, type Landmark, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  clearGestureScoreCameraCache,
  requestGestureScoreCamera,
  supportsGestureScoreCamera,
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
const HOLD_MS = 400
const COOLDOWN_MS = 1200

const DIGITS = [
  { tip: 8, pip: 6, mcp: 5 },
  { tip: 12, pip: 10, mcp: 9 },
  { tip: 16, pip: 14, mcp: 13 },
  { tip: 20, pip: 18, mcp: 17 },
] as const

type HoldState = {
  held: FingerScoreAction | null
  heldSince: number | null
  cooldownUntil: number
  awaitingRelease: boolean
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
    return tipDist > dist3(pipLm, wrist) * 1.04 && tipDist > dist3(mcpLm, wrist) * 1.02
  }
  const wrist = norm[0]
  const tipLm = norm[tip]
  const pipLm = norm[pip]
  if (!wrist || !tipLm || !pipLm) return false
  const tipDist = Math.hypot(tipLm.x - wrist.x, tipLm.y - wrist.y)
  const pipDist = Math.hypot(pipLm.x - wrist.x, pipLm.y - wrist.y)
  return tipDist > pipDist * 1.08
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
  return { held: null, heldSince: null, cooldownUntil: 0, awaitingRelease: false }
}

function stepHold(
  state: HoldState,
  detected: FingerScoreAction | null,
  now: number,
  preview: boolean,
): { state: HoldState; ui: HoldUi; fire: FingerScoreAction | null } {
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

  const cooldown = !preview && now < state.cooldownUntil
  const ui = (hold: FingerAction | null, progress: number): HoldUi => ({
    activeHold: hold,
    holdProgress: progress,
    gestureCooldown: cooldown,
  })

  if (state.awaitingRelease) {
    const next = detected ? state : { ...state, awaitingRelease: false }
    return { state: { ...next, held: null, heldSince: null }, ui: ui(null, 0), fire: null }
  }

  if (!detected) {
    const grace =
      state.held && state.heldSince != null && now - state.heldSince < HOLD_MS ? state.held : null
    if (!grace) {
      return { state: { ...state, held: null, heldSince: null }, ui: ui(null, 0), fire: null }
    }
    const progress = Math.min(1, (now - (state.heldSince ?? now)) / HOLD_MS)
    return { state, ui: ui(asFingerAction(grace), progress), fire: null }
  }

  if (cooldown) {
    return { state: { ...state, held: null, heldSince: null }, ui: ui(null, 0), fire: null }
  }

  if (state.held !== detected) {
    return {
      state: { ...state, held: detected, heldSince: now },
      ui: ui(asFingerAction(detected), 0),
      fire: null,
    }
  }

  const heldFor = now - (state.heldSince ?? now)
  const progress = Math.min(1, heldFor / HOLD_MS)
  if (!preview && heldFor >= HOLD_MS) {
    return {
      state: { ...state, held: null, heldSince: null },
      ui: ui(null, 0),
      fire: detected,
    }
  }

  return { state, ui: ui(asFingerAction(detected), progress), fire: null }
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
  preview?: boolean
  onFire: (action: FingerScoreAction) => void
  onHoldUi?: (ui: HoldUi) => void
  onStatus?: (status: EngineStatus) => void
  onError?: (message: string) => void
}

/** Camera + hand landmarker + finger count + hold. Pages wire onFire only. */
export class GestureCameraEngine {
  private landmarker: HandLandmarker | null = null
  private stream: MediaStream | null = null
  private frameId: number | null = null
  private runId = 0
  private frameTs = 0
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
    this.hold = { ...this.hold, held: null, heldSince: null }
  }

  markScoreCommitted(now = performance.now()): void {
    this.hold = {
      ...this.hold,
      held: null,
      heldSince: null,
      cooldownUntil: now + COOLDOWN_MS,
      awaitingRelease: true,
    }
  }

  markScoreBlocked(now = performance.now()): void {
    this.hold = { ...this.hold, held: null, heldSince: null, cooldownUntil: now + COOLDOWN_MS }
  }

  async restart(): Promise<void> {
    this.stop()
    await this.start()
  }

  async start(): Promise<void> {
    const runId = ++this.runId
    if (!supportsGestureScoreCamera()) {
      this.config.onStatus?.('unsupported')
      return
    }
    try {
      this.config.onStatus?.('loading')
      const vision = await FilesetResolver.forVisionTasks(WASM)
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
      const stream = await (takeGestureScoreCameraRequest() ?? requestGestureScoreCamera())
      if (this.runId !== runId) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.stream = stream
      const { video } = this.config
      video.srcObject = stream
      await video.play()
      if (this.runId !== runId) return
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
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    clearGestureScoreCameraCache()
    if (this.config.video) this.config.video.srcObject = null
    this.landmarker?.close()
    this.landmarker = null
    this.frameTs = 0
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
    if (!landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.frameId = requestAnimationFrame(this.tick)
      return
    }

    const now = performance.now()
    this.frameTs = now <= this.frameTs ? this.frameTs + 1 : now

    let detected: FingerScoreAction | null = null
    try {
      const result = landmarker.detectForVideo(video, this.frameTs)
      detected = fingerActionFromLandmarks(
        pickHand(result.landmarks),
        pickHand(result.worldLandmarks),
      )
    } catch {
      this.frameId = requestAnimationFrame(this.tick)
      return
    }

    const step = stepHold(this.hold, detected, now, Boolean(preview))
    this.hold = step.state
    if (onHoldUi) {
      const ui = step.ui
      const prev = this.lastUi
      if (
        !prev ||
        prev.activeHold !== ui.activeHold ||
        prev.gestureCooldown !== ui.gestureCooldown ||
        Math.abs(prev.holdProgress - ui.holdProgress) > 0.012
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
