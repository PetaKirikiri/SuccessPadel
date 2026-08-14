import { FilesetResolver, ObjectDetector, type Detection } from '@mediapipe/tasks-vision'
import { useEffect, type RefObject } from 'react'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite'

const FRAME_MS = 180
const MIN_SCORE = 0.18

function isSportsBall(detection: Detection): boolean {
  return detection.categories.some((category) => {
    const label = category.categoryName.toLowerCase()
    return label === 'sports ball' && category.score >= MIN_SCORE
  })
}

function bestSportsBall(detections: Detection[]): Detection | null {
  let best: Detection | null = null
  let bestScore = 0
  for (const detection of detections) {
    const score = detection.categories
      .filter((category) => category.categoryName.toLowerCase() === 'sports ball')
      .reduce((max, category) => Math.max(max, category.score), 0)
    if (score >= MIN_SCORE && score > bestScore) {
      best = detection
      bestScore = score
    }
  }
  return best
}

function drawDetection(ctx: CanvasRenderingContext2D, detection: Detection | null): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  if (!detection?.boundingBox) return

  const { originX, originY, width, height } = detection.boundingBox
  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = Math.max(3, Math.round(ctx.canvas.width / 180))
  ctx.shadowColor = 'rgb(34 197 94 / 0.7)'
  ctx.shadowBlur = 8
  ctx.strokeRect(originX, originY, width, height)
  ctx.shadowBlur = 0
}

/**
 * Throwaway visual probe: runs a real COCO object detector and draws a box
 * around detections labeled "sports ball". It does not feed scoring or state.
 */
export function useTennisBallDebugOverlay(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!enabled || !canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false
    let frameId = 0
    let lastFrameAt = 0
    let detector: ObjectDetector | null = null
    let frameTs = 0

    const start = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM)
        if (cancelled) return
        detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          maxResults: 5,
          scoreThreshold: MIN_SCORE,
          categoryAllowlist: ['sports ball'],
        })
      } catch {
        if (cancelled) return
        const vision = await FilesetResolver.forVisionTasks(WASM)
        if (cancelled) return
        detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          maxResults: 5,
          scoreThreshold: MIN_SCORE,
          categoryAllowlist: ['sports ball'],
        })
      }

      const tick = (now: number) => {
        frameId = requestAnimationFrame(tick)
        if (!detector || now - lastFrameAt < FRAME_MS) return
        lastFrameAt = now

        const sourceW = video.videoWidth
        const sourceH = video.videoHeight
        if (!sourceW || !sourceH || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          return
        }

        if (canvas.width !== sourceW || canvas.height !== sourceH) {
          canvas.width = sourceW
          canvas.height = sourceH
        }

        frameTs = now <= frameTs ? frameTs + 1 : now
        const result = detector.detectForVideo(video, frameTs)
        const sportsBalls = result.detections.filter(isSportsBall)
        drawDetection(ctx, bestSportsBall(sportsBalls))
      }

      frameId = requestAnimationFrame(tick)
    }

    void start()

    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
      detector?.close()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [canvasRef, enabled, videoRef])
}
