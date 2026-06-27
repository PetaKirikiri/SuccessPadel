import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FingerAction = 'team1' | 'team2' | 'undo'

export const GESTURE_CAMERA_HOLD_MS = 400
export const GESTURE_CAMERA_COOLDOWN_MS = 1200
export const GESTURE_CAMERA_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
/** Hand landmarker — finger counting only (more reliable than gesture classifier). */
export const GESTURE_CAMERA_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

function dist3(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.hypot(dx, dy, dz)
}

function isFingerExtendedWorld(landmarks: Landmark[], tip: number, pip: number, mcp: number): boolean {
  const wrist = landmarks[0]
  const tipLm = landmarks[tip]
  const pipLm = landmarks[pip]
  const mcpLm = landmarks[mcp]
  if (!wrist || !tipLm || !pipLm || !mcpLm) return false
  const tipDist = dist3(tipLm, wrist)
  const pipDist = dist3(pipLm, wrist)
  const mcpDist = dist3(mcpLm, wrist)
  return tipDist > pipDist * 1.04 && tipDist > mcpDist * 1.02
}

function isFingerExtendedNorm(landmarks: NormalizedLandmark[], tip: number, pip: number): boolean {
  const wrist = landmarks[0]
  const tipLm = landmarks[tip]
  const pipLm = landmarks[pip]
  if (!wrist || !tipLm || !pipLm) return false
  const tipDist = Math.hypot(tipLm.x - wrist.x, tipLm.y - wrist.y)
  const pipDist = Math.hypot(pipLm.x - wrist.x, pipLm.y - wrist.y)
  return tipDist > pipDist * 1.08
}

function fingerExtended(
  landmarks: NormalizedLandmark[],
  world: Landmark[] | undefined,
  tip: number,
  pip: number,
  mcp: number,
): boolean {
  if (world?.length) return isFingerExtendedWorld(world, tip, pip, mcp)
  return isFingerExtendedNorm(landmarks, tip, pip)
}

export function fingerActionFromLandmarks(
  landmarks: NormalizedLandmark[] | undefined,
  worldLandmarks?: Landmark[] | undefined,
): FingerAction | null {
  if (!landmarks?.length) return null
  const world = worldLandmarks?.length ? worldLandmarks : undefined
  const extended = [
    fingerExtended(landmarks, world, 8, 6, 5),
    fingerExtended(landmarks, world, 12, 10, 9),
    fingerExtended(landmarks, world, 16, 14, 13),
  ].filter(Boolean).length

  if (extended === 1) return 'team1'
  if (extended === 2) return 'team2'
  if (extended === 3) return 'undo'
  return null
}

export function pickGestureHandLandmarks(
  hands: NormalizedLandmark[][] | undefined,
): NormalizedLandmark[] | undefined {
  if (!hands?.length) return undefined
  return hands.find((hand) => hand.length > 0)
}

export function pickGestureHandWorldLandmarks(
  hands: Landmark[][] | undefined,
): Landmark[] | undefined {
  if (!hands?.length) return undefined
  return hands.find((hand) => hand.length > 0)
}

export function gestureCameraBeep(): void {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 720
    gain.gain.value = 0.05
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.09)
    window.setTimeout(() => void ctx.close(), 160)
  } catch {
    // Scoring still works if audio is unavailable.
  }
}
