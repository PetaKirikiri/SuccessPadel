import type { Sample, Shot } from './tacticsModel.ts'

/** Interpolate by simulated time, preserving speed changes after a bounce. */
export function sampleAtTime(shot: Shot, time: number): Sample | null {
  const first = shot.samples[0], last = shot.samples.at(-1)
  if (!first || !last) return null
  if (time <= first.t) return first
  if (time >= last.t) return last
  const index = shot.samples.findIndex(p => p.t >= time)
  const a = shot.samples[index - 1], b = shot.samples[index]
  const mix = (time - a.t) / (b.t - a.t)
  return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix, z: a.z + (b.z - a.z) * mix, t: time, bounced: b.bounced }
}

/** A short reset pause separates each replay; travel itself uses real shot timing. */
export function playbackTime(shot: Shot, elapsed: number): number | null {
  const end = shot.samples.at(-1)?.t ?? 0
  if (end <= 0) return null
  const phase = Math.max(0, elapsed) % (end + 0.8)
  const time = phase - 0.2
  return time < 0 || time > end ? null : time
}


/** Screen-space size is a height cue, capped at a five-metre lob's size.
 * Keep net-height changes subtle; use the full range only for genuinely high balls.
 */
export function ballRadiusAtHeight(height: number): number {
  const z = Math.max(0, Math.min(5, height))
  if (z <= 0.95) return 6 + (z / 0.95) * 1.25
  return 7.25 + ((z - 0.95) / 4.05) * 4.75
}
