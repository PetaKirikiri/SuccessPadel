const TWO_MINUTES_MS = 120_000

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    audioCtx ??= new AudioContext()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

export function playTwoMinuteAlarm(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const beep = (at: number) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.12, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.12)
  }

  const t = ctx.currentTime
  beep(t)
  beep(t + 0.18)
}

export { TWO_MINUTES_MS }
