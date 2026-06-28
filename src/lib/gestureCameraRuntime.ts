import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import {
  GESTURE_CAMERA_MODEL_URL,
  GESTURE_CAMERA_WASM_BASE,
} from './gestureCameraDetect'

/** Mediapipe HandLandmarker setup — no UI. */
export async function createGestureHandLandmarker(): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(GESTURE_CAMERA_WASM_BASE)
  const recognizerOptions = {
    runningMode: 'VIDEO' as const,
    numHands: 1,
  }
  try {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: GESTURE_CAMERA_MODEL_URL,
        delegate: 'GPU',
      },
      ...recognizerOptions,
    })
  } catch {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: GESTURE_CAMERA_MODEL_URL,
        delegate: 'CPU',
      },
      ...recognizerOptions,
    })
  }
}
