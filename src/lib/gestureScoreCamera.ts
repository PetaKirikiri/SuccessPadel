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
  if (!pendingCameraRequest) {
    pendingCameraRequest = navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS).catch((error) => {
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
