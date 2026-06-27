import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FingerAction = 'team1' | 'team2' | 'undo'

export const GESTURE_CAMERA_HOLD_MS = 400
export const GESTURE_CAMERA_COOLDOWN_MS = 1200
export const GESTURE_CAMERA_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
export const GESTURE_CAMERA_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'

function isFingerExtended(landmarks: NormalizedLandmark[], tip: number, pip: number): boolean {
  return landmarks[tip]?.y < landmarks[pip]?.y - 0.03
}

export function fingerActionFromLandmarks(
  landmarks: NormalizedLandmark[] | undefined,
): FingerAction | null {
  if (!landmarks?.length) return null
  const extended = [
    isFingerExtended(landmarks, 8, 6),
    isFingerExtended(landmarks, 12, 10),
    isFingerExtended(landmarks, 16, 14),
    isFingerExtended(landmarks, 20, 18),
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
