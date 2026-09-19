// @refresh reset
// Apply default-zoom calibration changes on hot refresh instead of retaining the previous zoom.
import { useCallback, useRef, useState } from 'react'
import { prepareRecognitionFrame, type RecognitionZoom } from '../lib/gestureRecognitionZoom'

/** Stable callback: changing zoom never restarts the engine or resets its score latch. */
export function useGestureRecognitionZoom() {
  const [zoom, setZoomState] = useState<RecognitionZoom>(2)
  const zoomRef = useRef<RecognitionZoom>(2)
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null)
  const setZoom = useCallback((value: RecognitionZoom) => {
    zoomRef.current = value
    setZoomState(value)
  }, [])
  const prepareThumbFrame = useCallback((video: HTMLVideoElement) =>
    prepareRecognitionFrame(video, zoomCanvasRef.current, zoomRef.current), [])
  return { zoom, setZoom, zoomCanvasRef, prepareThumbFrame }
}
