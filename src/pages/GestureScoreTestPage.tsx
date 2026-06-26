import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'
import { ArrowLeft, Hand, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  requestGestureScoreCamera,
  supportsGestureScoreCamera,
  takeGestureScoreCameraRequest,
} from '../lib/gestureScoreCamera'
import { useGesturePadChrome } from '../lib/gesturePadChrome'

type GestureName = 'Thumb_Up' | 'Thumb_Down'
type Status = 'idle' | 'loading' | 'running' | 'unsupported' | 'error'
type Team = 'us' | 'them'
type GestureScoreLocationState = {
  cameraError?: string
}

const HOLD_MS = 700
const COOLDOWN_MS = 2000
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'

function pointDisplay(points: number): string {
  return ['0', '15', '30', '40'][Math.min(points, 3)] ?? '40'
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
  const location = useLocation()
  const routeState = location.state as GestureScoreLocationState | null
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

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
    if (routeState?.cameraError) {
      setStatus('error')
      setError(routeState.cameraError)
      return stopCamera
    }
    void startCameraTest()
    return stopCamera
  }, [routeState?.cameraError])

  useEffect(() => {
    const startedAt = Date.now()
    const tick = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(tick)
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
    if (!supportsGestureScoreCamera()) {
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

      const stream = await (takeGestureScoreCameraRequest() ?? requestGestureScoreCamera())
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
  const showStartCameraButton = status === 'error' || status === 'unsupported'
  const goBack = () => {
    stopCamera()
    if (window.history.length > 1) navigate(-1)
    else navigate('/friendly')
  }

  return (
    <main className="fixed inset-0 z-[420] flex min-h-0 flex-col overflow-hidden bg-[#0b2a4a] text-white">
      <video ref={videoRef} muted playsInline className="pointer-events-none absolute h-1 w-1 opacity-0" />
      <header className="flex shrink-0 items-center justify-center px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6 md:pb-3">
        <div className="rounded-full border border-white/15 bg-[#11355c] px-6 py-2 text-center shadow-lg shadow-black/25">
          <p className="text-[10px] font-black uppercase tracking-wide text-white/55 md:text-xs">
            Time
          </p>
          <p className="font-display text-4xl font-black leading-none text-[#f8fafc] md:text-6xl">
            {formatTimer(elapsedSeconds)}
          </p>
        </div>
        {showStartCameraButton ? (
          <button
            type="button"
            onClick={() => void startCameraTest()}
            className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[430] rounded-full border border-[#34d399]/45 bg-[#34d399]/15 px-4 py-2 text-sm font-black uppercase tracking-wide text-[#34d399] shadow-lg shadow-black/25 active:scale-[0.98] md:right-6 md:px-5 md:py-3 md:text-base"
          >
            Start Camera
          </button>
        ) : null}
      </header>

      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,0.25fr)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8">
        <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-white/15 bg-[#11355c] px-4 py-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.7)] md:px-8 md:py-6">
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-black uppercase tracking-wide text-white/55 md:text-lg">
              Our Team
            </p>
            <p className="mt-1 text-sm font-bold text-[#7dd3fc] md:text-base">
              Games {ourGames}
            </p>
            <p className="font-display text-[clamp(7rem,22vw,20rem)] font-black leading-[0.78] text-[#f8fafc]">
              {pointDisplay(ourPoints)}
            </p>
          </div>

          <div className="flex min-w-[5rem] flex-col items-center gap-2 md:min-w-[8rem]">
            {goldenPoint ? (
              <p className="rounded-full border border-white/15 bg-[#34d399]/15 px-3 py-1 text-center text-[10px] font-black uppercase tracking-wide text-[#34d399] md:text-xs">
                Golden point
              </p>
            ) : null}
            <p className="font-display text-5xl font-black text-[#7dd3fc] md:text-8xl">:</p>
          </div>

          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-black uppercase tracking-wide text-white/55 md:text-lg">
              Other Team
            </p>
            <p className="mt-1 text-sm font-bold text-[#7dd3fc] md:text-base">
              Games {theirGames}
            </p>
            <p className="font-display text-[clamp(7rem,22vw,20rem)] font-black leading-[0.78] text-[#f8fafc]">
              {pointDisplay(theirPoints)}
            </p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-7xl justify-center gap-3 py-4 md:gap-7 md:py-6">
          <button
            type="button"
            onClick={() => addScore('Thumb_Up')}
            className="flex min-w-[7.5rem] items-center justify-center gap-3 rounded-full border border-[#34d399]/45 bg-[#34d399]/15 px-5 py-5 text-[#34d399] shadow-xl shadow-black/25 active:scale-[0.96] md:min-w-[13rem] md:gap-5 md:px-9 md:py-7"
            aria-label="Point for us"
            title="Point for us"
          >
            <ThumbsUp className="h-11 w-11 stroke-[3] text-[#34d399] md:h-20 md:w-20" aria-hidden />
            <span className="text-2xl font-black uppercase tracking-wide md:text-5xl">Win</span>
          </button>
          <button
            type="button"
            onClick={() => addScore('Thumb_Down')}
            className="flex min-w-[7.5rem] items-center justify-center gap-3 rounded-full border border-[#60a5fa]/45 bg-[#60a5fa]/15 px-5 py-5 text-[#60a5fa] shadow-xl shadow-black/25 active:scale-[0.96] md:min-w-[13rem] md:gap-5 md:px-9 md:py-7"
            aria-label="Point for them"
            title="Point for them"
          >
            <ThumbsDown className="h-11 w-11 stroke-[3] text-[#60a5fa] md:h-20 md:w-20" aria-hidden />
            <span className="text-2xl font-black uppercase tracking-wide md:text-5xl">Lose</span>
          </button>
          <button
            type="button"
            onClick={reset}
            className="relative flex min-w-[7.5rem] items-center justify-center gap-3 rounded-full border border-white/15 bg-[#11355c] px-5 py-5 text-[#7dd3fc] shadow-xl shadow-black/25 active:scale-[0.96] md:min-w-[13rem] md:gap-5 md:px-9 md:py-7"
            aria-label="Reset score"
            title="Reset score"
          >
            <span className="relative flex h-11 w-11 items-center justify-center md:h-20 md:w-20">
              <Hand className="h-11 w-11 stroke-[3] md:h-20 md:w-20" aria-hidden />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-[#60a5fa] md:h-7 md:w-7" aria-hidden />
              <Sparkles className="absolute -bottom-1 -left-1 h-3.5 w-3.5 text-[#34d399] md:h-5 md:w-5" aria-hidden />
            </span>
            <span className="text-2xl font-black uppercase tracking-wide md:text-5xl">Reset</span>
          </button>
        </div>

        <div className="relative flex min-h-0 items-center justify-center">
          {confirmation ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#60a5fa]/20">
              <div className="rounded-xl border border-white/15 bg-[#11355c] px-6 py-4 text-center font-display text-3xl font-black text-[#f8fafc] shadow-lg md:text-5xl">
                {confirmation}
              </div>
            </div>
          ) : null}
          {error ? (
            <p className="mx-auto max-w-xl rounded-lg border border-[#60a5fa]/45 bg-[#60a5fa]/15 px-3 py-2 text-center text-sm font-bold text-[#60a5fa]">
              {error}
            </p>
          ) : null}
          {status === 'unsupported' ? (
            <p className="mx-auto max-w-xl rounded-lg border border-[#fbbf24]/45 bg-[#fbbf24]/15 px-3 py-2 text-center text-sm font-bold text-[#fde68a]">
              This browser does not support camera access.
            </p>
          ) : null}
        </div>
      </section>
      <button
        type="button"
        onClick={goBack}
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-[430] flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#11355c] text-[#f8fafc] active:scale-[0.98] md:h-10 md:w-10"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5 stroke-[3]" aria-hidden />
      </button>
    </main>
  )
}
