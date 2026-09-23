export class CourtPublisher {
  media: MediaStream | null = null
  peer: RTCPeerConnection | null = null
  private location: string | null = null
  private token = ''
  private closed = false
  private wake: WakeLockSentinel | null = null
  async camera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Open Success Padel over HTTPS in Safari or Chrome to use the camera.')
    const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }, audio: true })
    if (this.closed) { media.getTracks().forEach(t => t.stop()); throw new Error('Camera cancelled') }
    this.media = media
    return media
  }
  async keepAwake() {
    try { if ('wakeLock' in navigator && !this.closed) this.wake = await navigator.wakeLock.request('screen') } catch { /* not supported in every mobile context */ }
    if (this.closed) void this.wake?.release()
  }
  async publish(settings: { url: string; token: string; iceServers: RTCIceServer[] }) {
    if (!this.media || this.closed) throw new Error('Open the camera first')
    const peer = new RTCPeerConnection({ iceServers: settings.iceServers })
    this.peer = peer; this.token = settings.token
    for (const track of this.media.getTracks()) peer.addTrack(track, this.media)
    // Let the browser negotiate its native encoder; the server normalizes codecs.
    await peer.setLocalDescription(await peer.createOffer())
    // Full ICE gathering avoids relying on unsupported trickle PATCH implementations.
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        if (peer.iceGatheringState === 'complete') { cleanup(); resolve() }
        else if (peer.connectionState === 'closed') { cleanup(); reject(new Error('Camera stopped')) }
      }
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Could not connect to the streaming network. Try another connection.')) }, 15000)
      const cleanup = () => { clearTimeout(timeout); peer.removeEventListener('icegatheringstatechange',finish); peer.removeEventListener('connectionstatechange',finish) }
      peer.addEventListener('icegatheringstatechange',finish); peer.addEventListener('connectionstatechange',finish); finish()
    })
    const response = await fetch(settings.url, { method: 'POST', headers: { Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/sdp' }, body: peer.localDescription!.sdp, signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error('The media server rejected the camera connection.')
    const location = response.headers.get('Location')
    if (!location) throw new Error('The media server did not return a publishing session.')
    const endpoint = new URL(location, settings.url)
    if (endpoint.origin !== new URL(settings.url).origin) throw new Error('Unexpected publishing endpoint')
    this.location = endpoint.href
    if (this.closed) { this.close(); return }
    await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() })
    await this.keepAwake()
  }
  close() {
    this.closed = true
    this.peer?.close(); this.media?.getTracks().forEach(t => t.stop()); void this.wake?.release()
    if (this.location) {
      void fetch(this.location, { method: 'DELETE', headers: { Authorization: `Bearer ${this.token}` }, keepalive: true }).catch(() => {})
      this.location = null
    }
  }
}
