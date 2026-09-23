import { createHmac, timingSafeEqual } from 'node:crypto'
export const ACTIVE = ['preparing', 'connecting', 'live', 'stopping']
export function titleFor(match) {
  const clean = (s) => String(s).replace(/[<>\r\n]/g, ' ').trim()
  return Array.from(clean(`Success Padel – Round ${match.round_number} – ${match.court_name} – ${match.teams.a.join(' & ')} vs ${match.teams.b.join(' & ')}`)).slice(0, 100).join('')
}
export function signPublish(secret, id, expires) {
  const body = `${id}.${expires}`
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}
export function verifyPublish(secret, token, path, now = Date.now()) {
  if (typeof token !== 'string') return false
  const [id, expiry, signature] = token.split('.')
  if (!signature || path !== `court/${id}` || !Number.isFinite(Number(expiry)) || Number(expiry) <= now) return false
  const expected = signPublish(secret, id, expiry)
  const actualBytes = Buffer.from(token), expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}
export function ffmpegArgs(input, output) {
  const url = new URL(output)
  if (url.protocol !== 'rtmps:' || !/^(?:[a-z0-9-]+\.)*youtube\.com$/.test(url.hostname)) throw new Error('Invalid YouTube ingest endpoint')
  return ['-hide_banner', '-loglevel', 'error', '-nostdin', '-rtsp_transport', 'tcp', '-i', input,
    '-map', '0:v:0', '-map', '0:a:0', '-vf', "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
    '-b:v', '10M', '-maxrate', '10M', '-bufsize', '20M', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-f', 'flv', '-tls_verify', '1', output]
}
export function publicStatus(row) {
  return { id: row.id, state: row.state, title: row.title, live_at: row.live_at, error: row.error,
    videoUrl: row.broadcast_id ? `https://www.youtube.com/watch?v=${encodeURIComponent(row.broadcast_id)}` : null }
}
