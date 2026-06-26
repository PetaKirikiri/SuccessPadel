import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'
import { ArrowLeft, Hand, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGesturePadChrome } from '../lib/gesturePadChrome'

type GestureName = 'Thumb_Up' | 'Thumb_Down'
type Status = 'idle' | 'loading' | 'running' | 'unsupported' | 'error'
type Team = 'us' | 'them'

const HOLD_MS = 700
const COOLDOWN_MS = 2000
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'

function pointDisplay(points: number): string {
  return ['0', '15', '30', '40'][Math.min(points, 3)] ?? '40'
}

function beep(): void {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 720
    gain.gain.value = 0.05
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.09)
    window.setTimeout(() => void ctx.close(), 160)
  } catch {
    // Visual confirmation still works if audio is unavailable.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export function GestureScoreTestPage() {
  useGesturePadChrome()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognizerRef = useRef<GestureRecognizer | null>(null)
  const frameRef = useRef<number | null>(null)
  const heldGestureRef = useRef<GestureName | null>(null)
  const heldSinceRef = useRef<number | null>(null)
  const cooldownUntilRef = useRef(0)
  const cameraRunRef = useRef(0)
  const scoreRef = useRef({ ourPoints: 0, theirPoints: 0, ourGames: 0, theirGames: 0 })

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [ourPoints, setOurPoints] = useState(0)
  const [theirPoints, setTheirPoints] = useState(0)
  const [ourGames, setOurGames] = useState(0)
  const [theirGames, setTheirGames] = useState(0)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const stopCamera = () => {
    cameraRunRef.current += 1
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    recognizerRef.current?.close()
    recognizerRef.current = null
    heldGestureRef.current = null
    heldSinceRef.current = null
    setStatus('idle')
  }

  useEffect(() => {
    void startCameraTest()
    return stopCamera
  }, [])

  const applyPadelPoint = (winner: Team): string => {
    const ourWon = winner === 'us'
    const current = scoreRef.current
    const winnerPoints = ourWon ? current.ourPoints : current.theirPoints
    const loserPoints = ourWon ? current.theirPoints : current.ourPoints
    const gameWon = winnerPoints >= 3

    if (gameWon) {
      scoreRef.current = {
        ourPoints: 0,
        theirPoints: 0,
        ourGames: current.ourGames + (ourWon ? 1 : 0),
        theirGames: current.theirGames + (ourWon ? 0 : 1),
      }
      setOurGames(scoreRef.current.ourGames)
      setTheirGames(scoreRef.current.theirGames)
      setOurPoints(0)
      setTheirPoints(0)
      return `${ourWon ? 'Our Team' : 'Other Team'} wins game`
    }

    const nextWinnerPoints = winnerPoints + 1
    scoreRef.current = {
      ...current,
      ourPoints: ourWon ? nextWinnerPoints : current.ourPoints,
      theirPoints: ourWon ? current.theirPoints : nextWinnerPoints,
    }
    setOurPoints(scoreRef.current.ourPoints)
    setTheirPoints(scoreRef.current.theirPoints)

    return nextWinnerPoints === 3 && loserPoints === 3
      ? 'Golden point'
      : `${ourWon ? 'Our Team' : 'Other Team'} ${pointDisplay(nextWinnerPoints)}`
  }

  const addScore = (gesture: GestureName) => {
    cooldownUntilRef.current = performance.now() + COOLDOWN_MS
    heldGestureRef.current = null
    heldSinceRef.current = null
    const scoreMessage = applyPadelPoint(gesture === 'Thumb_Up' ? 'us' : 'them')
    setConfirmation(scoreMessage)
    beep()
    window.setTimeout(() => setConfirmation(null), 850)
  }

  const detectFrame = () => {
    const recognizer = recognizerRef.current
    const video = videoRef.current
    if (!recognizer || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      frameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    const now = performance.now()
    const result = recognizer.recognizeForVideo(video, now)
    const category = result.gestures[0]?.[0]
    const gesture = category?.categoryName as GestureName | undefined
    const accepted = gesture === 'Thumb_Up' || gesture === 'Thumb_Down'

    if (!accepted) {
      heldGestureRef.current = null
      heldSinceRef.current = null
      frameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    if (now < cooldownUntilRef.current) {
      frameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    if (heldGestureRef.current !== gesture) {
      heldGestureRef.current = gesture
      heldSinceRef.current = now
    } else {
      const heldFor = now - (heldSinceRef.current ?? now)
      if (heldFor >= HOLD_MS) addScore(gesture)
    }

    frameRef.current = requestAnimationFrame(detectFrame)
  }

  const startCameraTest = async () => {
    const runId = cameraRunRef.current + 1
    cameraRunRef.current = runId
    setError(null)
    setConfirmation(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }

    try {
      setStatus('loading')
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      })
      if (cameraRunRef.current !== runId) {
        recognizer.close()
        return
      }
      recognizerRef.current = recognizer

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 540 },
        },
        audio: false,
      })
      if (cameraRunRef.current !== runId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      if (!videoRef.current) throw new Error('Camera preview is not ready')
      videoRef.current.srcObject = stream
      try {
        await videoRef.current.play()
      } catch (playError) {
        if (cameraRunRef.current !== runId) return
        if (playError instanceof DOMException && playError.name === 'AbortError') return
        throw playError
      }
      if (cameraRunRef.current !== runId) return
      setStatus('running')
      frameRef.current = requestAnimationFrame(detectFrame)
    } catch (e) {
      if (cameraRunRef.current !== runId) return
      stopCamera()
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Camera permission or gesture setup failed')
    }
  }

  const reset = () => {
    setOurPoints(0)
    setTheirPoints(0)
    setOurGames(0)
    setTheirGames(0)
    scoreRef.current = { ourPoints: 0, theirPoints: 0, ourGames: 0, theirGames: 0 }
    setConfirmation(null)
    heldGestureRef.current = null
    heldSinceRef.current = null
    cooldownUntilRef.current = 0
  }

  const goldenPoint = ourPoints >= 3 && theirPoints >= 3
  const goBack = () => {
    stopCamera()
    if (window.history.length > 1) navigate(-1)
    else navigate('/friendly')
  }

  return (
    <main className="fixed inset-0 z-[420] flex min-h-0 flex-col overflow-hidden bg-brand-primary text-white">
      <video ref={videoRef} muted playsInline className="pointer-events-none absolute h-1 w-1 opacity-0" />
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6">
        <button
          type="button"
          onClick={goBack}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white active:scale-[0.98]"
          aria-label="Back"
        >
          <ArrowLeft className="h-7 w-7 stroke-[3]" aria-hidden />
        </button>
        <div className="min-w-0" aria-hidden />
        <div className="h-11 w-11" aria-hidden />
      </header>

      <section className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.7)] md:px-6 md:py-5">
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-black uppercase tracking-wide text-brand-accent-light/75 md:text-lg">
              Our Team
            </p>
            <p className="mt-1 text-sm font-bold text-brand-accent-light/70 md:text-base">
              Games {ourGames}
            </p>
            <p className="font-display text-[clamp(5rem,16vw,13rem)] font-black leading-[0.82] text-white">
              {pointDisplay(ourPoints)}
            </p>
          </div>

          <div className="flex min-w-[5rem] flex-col items-center gap-2 md:min-w-[8rem]">
            {goldenPoint ? (
              <p className="rounded-full border border-white/20 px-3 py-1 text-center text-[10px] font-black uppercase tracking-wide text-brand-accent-light/80 md:text-xs">
                Golden point
              </p>
            ) : null}
            <p className="font-display text-3xl font-black text-white/60 md:text-5xl">:</p>
          </div>

          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-black uppercase tracking-wide text-brand-accent-light/75 md:text-lg">
              Other Team
            </p>
            <p className="mt-1 text-sm font-bold text-brand-accent-light/70 md:text-base">
              Games {theirGames}
            </p>
            <p className="font-display text-[clamp(5rem,16vw,13rem)] font-black leading-[0.82] text-white">
              {pointDisplay(theirPoints)}
            </p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-5xl justify-center gap-3 py-5 md:gap-6 md:py-7">
          <button
            type="button"
            onClick={() => addScore('Thumb_Up')}
            className="flex items-center gap-3 rounded-full border border-emerald-300/35 bg-emerald-400/12 px-4 py-3 text-emerald-200 shadow-lg shadow-emerald-950/20 active:scale-[0.96] md:px-6 md:py-4"
            aria-label="Point for us"
            title="Point for us"
          >
            <ThumbsUp className="h-8 w-8 stroke-[2.8] text-emerald-300 md:h-11 md:w-11" aria-hidden />
            <span className="text-lg font-black uppercase tracking-wide md:text-2xl">Win</span>
          </button>
          <button
            type="button"
            onClick={() => addScore('Thumb_Down')}
            className="flex items-center gap-3 rounded-full border border-rose-300/35 bg-rose-400/12 px-4 py-3 text-rose-200 shadow-lg shadow-rose-950/20 active:scale-[0.96] md:px-6 md:py-4"
            aria-label="Point for them"
            title="Point for them"
          >
            <ThumbsDown className="h-8 w-8 stroke-[2.8] text-rose-300 md:h-11 md:w-11" aria-hidden />
            <span className="text-lg font-black uppercase tracking-wide md:text-2xl">Lose</span>
          </button>
          <button
            type="button"
            onClick={reset}
            className="relative flex items-center gap-3 rounded-full border border-white/20 bg-white/12 px-4 py-3 text-brand-accent-light shadow-lg active:scale-[0.96] md:px-6 md:py-4"
            aria-label="Reset score"
            title="Reset score"
          >
            <span className="relative flex h-8 w-8 items-center justify-center md:h-11 md:w-11">
              <Hand className="h-8 w-8 stroke-[2.8] md:h-11 md:w-11" aria-hidden />
              <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-brand-accent md:h-4 md:w-4" aria-hidden />
              <Sparkles className="absolute -bottom-1 -left-1 h-3 w-3 text-brand-accent-light md:h-3.5 md:w-3.5" aria-hidden />
            </span>
            <span className="text-lg font-black uppercase tracking-wide md:text-2xl">Reset</span>
          </button>
        </div>

        <div className="relative flex min-h-0 items-center justify-center">
          {confirmation ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-brand-accent/20">
              <div className="rounded-xl bg-white px-6 py-4 text-center font-display text-3xl font-black text-brand-primary shadow-lg md:text-5xl">
                {confirmation}
              </div>
            </div>
          ) : null}
          {error ? (
            <p className="mx-auto max-w-xl rounded-lg border border-red-200/40 bg-red-500/20 px-3 py-2 text-center text-sm font-bold text-red-50">
              {error}
            </p>
          ) : null}
          {status === 'unsupported' ? (
            <p className="mx-auto max-w-xl rounded-lg border border-amber-200/40 bg-amber-400/20 px-3 py-2 text-center text-sm font-bold text-amber-50">
              This browser does not support camera access.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
