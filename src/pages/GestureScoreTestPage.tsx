import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { FilesetResolver, GestureRecognizer, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  requestGestureScoreCamera,
  supportsGestureScoreCamera,
  takeGestureScoreCameraRequest,
} from '../lib/gestureScoreCamera'
import { useGesturePadChrome } from '../lib/gesturePadChrome'

type FingerAction = 'win' | 'lose' | 'undo' | 'reset'
type Status = 'idle' | 'loading' | 'running' | 'unsupported' | 'error'
type Team = 'us' | 'them'
type ScoreSnapshot = {
  ourPoints: number
  theirPoints: number
  ourGames: number
  theirGames: number
}
type GestureScoreLocationState = {
  cameraError?: string
}

const HOLD_MS = 400
const COOLDOWN_MS = 1200
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'
const scoreNumberStyle = {
  fontSize: 'clamp(3.5rem, min(23vw, 23vh), 16rem)',
} satisfies CSSProperties

function pointDisplay(points: number): string {
  return ['0', '15', '30', '40'][Math.min(points, 3)] ?? '40'
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function isFingerExtended(landmarks: NormalizedLandmark[], tip: number, pip: number): boolean {
  return landmarks[tip]?.y < landmarks[pip]?.y - 0.035
}

function fingerActionFromLandmarks(landmarks: NormalizedLandmark[] | undefined): FingerAction | null {
  if (!landmarks?.length) return null
  const extended = [
    isFingerExtended(landmarks, 8, 6),
    isFingerExtended(landmarks, 12, 10),
    isFingerExtended(landmarks, 16, 14),
    isFingerExtended(landmarks, 20, 18),
  ].filter(Boolean).length

  if (extended === 1) return 'win'
  if (extended === 2) return 'lose'
  if (extended === 3) return 'undo'
  if (extended === 4) return 'reset'
  return null
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
    // Scoring still works if audio is unavailable.
  }
}

function FingerCountIcon({ count }: { count: 1 | 2 | 3 | 4 }) {
  return (
    <img
      src={`/gesture-score/${count === 1 ? 'one-finger' : count === 2 ? 'two-fingers' : count === 3 ? 'three-fingers' : 'four-fingers'}.png`}
      alt=""
      className="h-7 w-7 shrink-0 object-contain sm:h-9 sm:w-9 md:h-20 md:w-20"
      aria-hidden="true"
      draggable={false}
    />
  )
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
  const heldGestureRef = useRef<FingerAction | null>(null)
  const heldSinceRef = useRef<number | null>(null)
  const cooldownUntilRef = useRef(0)
  const cameraRunRef = useRef(0)
  const scoreRef = useRef<ScoreSnapshot>({ ourPoints: 0, theirPoints: 0, ourGames: 0, theirGames: 0 })
  const historyRef = useRef<ScoreSnapshot[]>([])

  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [ourPoints, setOurPoints] = useState(0)
  const [theirPoints, setTheirPoints] = useState(0)
  const [ourGames, setOurGames] = useState(0)
  const [theirGames, setTheirGames] = useState(0)
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

  const applyScoreSnapshot = (snapshot: ScoreSnapshot) => {
    scoreRef.current = snapshot
    setOurPoints(snapshot.ourPoints)
    setTheirPoints(snapshot.theirPoints)
    setOurGames(snapshot.ourGames)
    setTheirGames(snapshot.theirGames)
  }

  const pushScoreSnapshot = () => {
    historyRef.current = [...historyRef.current.slice(-19), { ...scoreRef.current }]
  }

  const undoLastAction = () => {
    const previous = historyRef.current[historyRef.current.length - 1]
    if (!previous) return
    historyRef.current = historyRef.current.slice(0, -1)
    applyScoreSnapshot(previous)
  }

  const applyPadelPoint = (winner: Team): void => {
    const ourWon = winner === 'us'
    const current = scoreRef.current
    const winnerPoints = ourWon ? current.ourPoints : current.theirPoints
    const gameWon = winnerPoints >= 3
    pushScoreSnapshot()

    if (gameWon) {
      applyScoreSnapshot({
        ourPoints: 0,
        theirPoints: 0,
        ourGames: current.ourGames + (ourWon ? 1 : 0),
        theirGames: current.theirGames + (ourWon ? 0 : 1),
      })
      return
    }

    const nextWinnerPoints = winnerPoints + 1
    applyScoreSnapshot({
      ...current,
      ourPoints: ourWon ? nextWinnerPoints : current.ourPoints,
      theirPoints: ourWon ? current.theirPoints : nextWinnerPoints,
    })
  }

  const applyFingerAction = (action: FingerAction) => {
    heldGestureRef.current = null
    heldSinceRef.current = null
    if (action === 'reset') {
      pushScoreSnapshot()
      reset()
    } else if (action === 'undo') {
      undoLastAction()
    } else {
      applyPadelPoint(action === 'win' ? 'us' : 'them')
    }
    cooldownUntilRef.current = performance.now() + COOLDOWN_MS
    beep()
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
    const action = fingerActionFromLandmarks(result.landmarks[0])

    if (!action) {
      heldGestureRef.current = null
      heldSinceRef.current = null
      frameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    if (now < cooldownUntilRef.current) {
      frameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    if (heldGestureRef.current !== action) {
      heldGestureRef.current = action
      heldSinceRef.current = now
    } else {
      const heldFor = now - (heldSinceRef.current ?? now)
      if (heldFor >= HOLD_MS) applyFingerAction(action)
    }

    frameRef.current = requestAnimationFrame(detectFrame)
  }

  const startCameraTest = async () => {
    const runId = cameraRunRef.current + 1
    cameraRunRef.current = runId
    setError(null)
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
    applyScoreSnapshot({ ourPoints: 0, theirPoints: 0, ourGames: 0, theirGames: 0 })
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
      <video
        ref={videoRef}
        muted
        playsInline
        className={`pointer-events-none fixed right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[430] h-14 w-20 scale-x-[-1] rounded-lg border border-white/20 bg-[#06192d] object-cover shadow-2xl shadow-black/35 transition-opacity sm:right-3 sm:h-16 sm:w-24 md:right-6 md:h-36 md:w-48 ${
          status === 'running' || status === 'loading' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {showStartCameraButton ? (
        <button
          type="button"
          onClick={() => void startCameraTest()}
          className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[440] rounded-full border border-[#34d399]/45 bg-[#34d399]/15 px-4 py-2 text-sm font-black uppercase tracking-wide text-[#34d399] shadow-lg shadow-black/25 active:scale-[0.98] md:right-6 md:px-5 md:py-3 md:text-base"
        >
          Start Camera
        </button>
      ) : null}

      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,1.25rem)] gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 md:grid-rows-[minmax(18rem,1fr)_auto_minmax(2rem,0.12fr)] md:gap-6 md:px-8 md:pt-[max(0.75rem,env(safe-area-inset-top))] md:pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="relative mx-auto grid h-full min-h-0 w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1 overflow-hidden rounded-xl border border-white/15 bg-[#11355c] px-3 pb-3 pt-10 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.7)] md:gap-3 md:rounded-2xl md:px-8 md:pb-6 md:pt-16">
          <button
            type="button"
            onClick={goBack}
            className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#0b2a4a]/85 text-[#f8fafc] active:scale-[0.98] md:left-4 md:top-4 md:h-10 md:w-10"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 stroke-[3]" aria-hidden />
          </button>
          <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-[#0b2a4a]/70 px-4 py-1 text-center shadow-lg shadow-black/20 md:top-4 md:px-6 md:py-1.5">
            <p className="font-display text-2xl font-black leading-none text-[#f8fafc] md:text-5xl">
              {formatTimer(elapsedSeconds)}
            </p>
          </div>
          <div className="flex min-h-0 min-w-0 flex-col justify-center text-left">
            <p className="truncate text-[11px] font-black uppercase tracking-wide text-white/55 sm:text-xs md:text-lg">
              Our Team
            </p>
            <p className="mt-0.5 text-xs font-bold text-[#7dd3fc] md:mt-1 md:text-base">
              Games {ourGames}
            </p>
            <p className="mt-1 font-display font-black leading-[0.9] text-[#f8fafc] md:mt-4" style={scoreNumberStyle}>
              {pointDisplay(ourPoints)}
            </p>
          </div>

          <div className="flex min-h-0 min-w-[2.5rem] flex-col items-center justify-center gap-1 md:min-w-[8rem] md:gap-2">
            {goldenPoint ? (
              <p className="rounded-full border border-white/15 bg-[#34d399]/15 px-3 py-1 text-center text-[10px] font-black uppercase tracking-wide text-[#34d399] md:text-xs">
                Golden point
              </p>
            ) : null}
            <p className="font-display text-4xl font-black text-[#7dd3fc] md:text-8xl">:</p>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col justify-center text-right">
            <p className="truncate text-[11px] font-black uppercase tracking-wide text-white/55 sm:text-xs md:text-lg">
              Other Team
            </p>
            <p className="mt-0.5 text-xs font-bold text-[#7dd3fc] md:mt-1 md:text-base">
              Games {theirGames}
            </p>
            <p className="mt-1 font-display font-black leading-[0.9] text-[#f8fafc] md:mt-4" style={scoreNumberStyle}>
              {pointDisplay(theirPoints)}
            </p>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-7xl grid-cols-4 gap-1 py-1.5 md:gap-4 md:py-5">
          <button
            type="button"
            onClick={() => applyFingerAction('win')}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-[#34d399]/45 bg-[#34d399]/15 px-1 py-2 text-[#34d399] shadow-xl shadow-black/25 active:scale-[0.96] sm:gap-1 sm:py-3 md:flex-row md:gap-5 md:rounded-full md:px-7 md:py-7"
            aria-label="Point for us"
            title="Point for us"
          >
            <FingerCountIcon count={1} />
            <span className="text-[10px] font-black uppercase tracking-wide md:text-4xl">Win</span>
          </button>
          <button
            type="button"
            onClick={() => applyFingerAction('lose')}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-[#60a5fa]/45 bg-[#60a5fa]/15 px-1 py-2 text-[#60a5fa] shadow-xl shadow-black/25 active:scale-[0.96] sm:gap-1 sm:py-3 md:flex-row md:gap-5 md:rounded-full md:px-7 md:py-7"
            aria-label="Point for them"
            title="Point for them"
          >
            <FingerCountIcon count={2} />
            <span className="text-[10px] font-black uppercase tracking-wide md:text-4xl">Lose</span>
          </button>
          <button
            type="button"
            onClick={() => applyFingerAction('undo')}
            className="relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/15 bg-[#11355c] px-1 py-2 text-[#7dd3fc] shadow-xl shadow-black/25 active:scale-[0.96] sm:gap-1 sm:py-3 md:flex-row md:gap-5 md:rounded-full md:px-7 md:py-7"
            aria-label="Undo last score action"
            title="Undo last score action"
          >
            <FingerCountIcon count={3} />
            <span className="text-[10px] font-black uppercase tracking-wide md:text-4xl">Undo</span>
          </button>
          <button
            type="button"
            onClick={() => applyFingerAction('reset')}
            className="relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/15 bg-[#11355c] px-1 py-2 text-[#7dd3fc] shadow-xl shadow-black/25 active:scale-[0.96] sm:gap-1 sm:py-3 md:flex-row md:gap-5 md:rounded-full md:px-7 md:py-7"
            aria-label="Reset score"
            title="Reset score"
          >
            <FingerCountIcon count={4} />
            <span className="text-[10px] font-black uppercase tracking-wide md:text-4xl">Reset</span>
          </button>
        </div>

        <div className="relative flex min-h-0 items-center justify-center">
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
    </main>
  )
}
