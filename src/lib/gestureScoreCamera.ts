let pendingCameraRequest: Promise<MediaStream> | null = null

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: 'user',
    width: { ideal: 960 },
    height: { ideal: 540 },
  },
  audio: false,
}

export function supportsGestureScoreCamera(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

export function requestGestureScoreCamera(): Promise<MediaStream> {
  const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)
  if (!getUserMedia) {
    return Promise.reject(new Error('Camera is not available in this browser.'))
  }
  if (!pendingCameraRequest) {
    pendingCameraRequest = getUserMedia(CAMERA_CONSTRAINTS).catch((error) => {
      pendingCameraRequest = null
      throw error
    })
  }
  return pendingCameraRequest
}

export function takeGestureScoreCameraRequest(): Promise<MediaStream> | null {
  const request = pendingCameraRequest
  pendingCameraRequest = null
  return request
}

export function clearGestureScoreCameraCache(): void {
  pendingCameraRequest = null
}

/** Pre-request camera permission when user taps Score live. */
export function warmupGestureScoreCamera(): void {
  if (!supportsGestureScoreCamera()) return
  void requestGestureScoreCamera()
}
