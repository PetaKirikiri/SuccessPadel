export const RECOGNITION_ZOOMS = [1, 1.5, 2] as const
export type RecognitionZoom = (typeof RECOGNITION_ZOOMS)[number]

/** Centre crop in source pixels, before MediaPipe resizes its model input. */
export function recognitionCrop(width: number, height: number, zoom: RecognitionZoom) {
  const cropWidth = Math.max(1, Math.round(width / zoom))
  const cropHeight = Math.max(1, Math.round(height / zoom))
  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  }
}

export function prepareRecognitionFrame(
  video: HTMLVideoElement, canvas: HTMLCanvasElement | null, zoom: RecognitionZoom,
): HTMLVideoElement | HTMLCanvasElement {
  if (zoom === 1) return video
  if (!canvas || !video.videoWidth || !video.videoHeight) throw new Error('Recognition crop is not ready')
  const crop = recognitionCrop(video.videoWidth, video.videoHeight, zoom)
  if (canvas.width !== crop.width) canvas.width = crop.width
  if (canvas.height !== crop.height) canvas.height = crop.height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Recognition crop is unavailable')
  context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return canvas
}
