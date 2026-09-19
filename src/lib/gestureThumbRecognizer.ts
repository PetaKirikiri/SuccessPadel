import { GestureRecognizer } from '@mediapipe/tasks-vision'

/** Pin the model revision so upstream model updates cannot silently alter scoring. */
export const THUMB_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'

export async function createThumbRecognizer(
  vision: Parameters<typeof GestureRecognizer.createFromOptions>[0],
): Promise<GestureRecognizer> {
  const options = { runningMode: 'VIDEO' as const, numHands: 1 }
  try {
    return await GestureRecognizer.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: THUMB_MODEL_URL, delegate: 'GPU' },
    })
  } catch {
    return GestureRecognizer.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: THUMB_MODEL_URL, delegate: 'CPU' },
    })
  }
}
