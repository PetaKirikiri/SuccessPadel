import type { RefObject } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { EngineStatus } from '../../lib/gestureFingerDetect'

// The approved tester presentation. Both entry points render this exact markup.
// Existing styling is preserved verbatim; do not redesign it during scoring work.
function pointDisplay(points: number): string {
  return ['0', '15', '30', '40'][Math.min(points, 3)] ?? '40'
}

function FingerCountIcon({ count }: { count: 1 | 2 | 3 | 4 }) {
  return (
    <img
      src={`/gesture-score/${count === 1 ? 'thumb-up.svg' : count === 2 ? 'thumb-down.svg' : count === 3 ? 'undo.svg' : 'reset.svg'}`}
      alt=""
      className="h-9 w-9 shrink-0 object-contain md:h-20 md:w-20"
      aria-hidden="true"
      draggable={false}
    />
  )
}
type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  status: EngineStatus
  error: string | null
  ourPoints: number
  theirPoints: number
  ourGames: number
  theirGames: number
  timerValue: string
  onWin: () => void
  onLose: () => void
  onUndo: () => void
  onReset?: () => void
  undoDisabled?: boolean
  restartCamera: () => void
  goBack: () => void
}

export function ThumbScorePadView({ videoRef, status, error, ourPoints, theirPoints,
  ourGames, theirGames, timerValue, onWin, onLose, onUndo, onReset,
  undoDisabled = false, restartCamera, goBack }: Props) {
  const goldenPoint = ourPoints >= 3 && theirPoints >= 3
  const showStartCameraButton = status === 'idle' || status === 'error' || status === 'unsupported'
  return (
    <main className="gesture-score-pad fixed inset-0 z-[420] flex min-h-0 flex-col overflow-hidden bg-[#0b2a4a] text-white">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`gesture-score-pad__camera pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[430] h-16 w-24 scale-x-[-1] rounded-xl border border-white/20 bg-[#06192d] object-cover shadow-2xl shadow-black/35 transition-opacity md:right-6 md:h-36 md:w-48 ${
          status === 'running' || status === 'loading' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <header className="gesture-score-pad__header flex shrink-0 items-center justify-center px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6 md:pb-3">
        <div className="gesture-score-pad__timer rounded-full border border-white/15 bg-[#11355c] px-6 py-2 text-center shadow-lg shadow-black/25">
          <p className="text-[10px] font-black uppercase tracking-wide text-white/55 md:text-xs">
            Time
          </p>
          <p className="font-display text-4xl font-black leading-none text-[#f8fafc] md:text-6xl">
            {timerValue}
          </p>
        </div>
        {showStartCameraButton ? (
          <button
            type="button"
            onClick={restartCamera}
            className="gesture-score-pad__start-camera fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[430] rounded-full border border-[#34d399]/45 bg-[#34d399]/15 px-4 py-2 text-sm font-black uppercase tracking-wide text-[#34d399] shadow-lg shadow-black/25 active:scale-[0.98] md:right-6 md:px-5 md:py-3 md:text-base"
          >
            Start Camera
          </button>
        ) : null}
      </header>

      <section className="gesture-score-pad__body grid min-h-0 flex-1 grid-rows-[minmax(18rem,1fr)_auto_minmax(2rem,0.12fr)] gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:gap-6 md:px-8">
        <div className="gesture-score-pad__score-panel mx-auto grid h-full min-h-0 w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3 overflow-hidden rounded-2xl border border-white/15 bg-[#11355c] px-4 py-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.7)] md:px-8 md:py-6">
          <div className="flex min-h-0 min-w-0 flex-col justify-center text-left">
            <p className="truncate text-sm font-black uppercase tracking-wide text-white/55 md:text-lg">
              Our Team
            </p>
            <p className="mt-1 text-sm font-bold text-[#7dd3fc] md:text-base">
              Games {ourGames}
            </p>
            <p className="mt-4 font-display text-[clamp(7rem,22vw,20rem)] font-black leading-none text-[#f8fafc]">
              {pointDisplay(ourPoints)}
            </p>
          </div>

          <div className="flex min-h-0 min-w-[5rem] flex-col items-center justify-center gap-2 md:min-w-[8rem]">
            {goldenPoint ? (
              <p className="rounded-full border border-white/15 bg-[#34d399]/15 px-3 py-1 text-center text-[10px] font-black uppercase tracking-wide text-[#34d399] md:text-xs">
                Golden point
              </p>
            ) : null}
            <p className="font-display text-5xl font-black text-[#7dd3fc] md:text-8xl">:</p>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col justify-center text-right">
            <p className="truncate text-sm font-black uppercase tracking-wide text-white/55 md:text-lg">
              Other Team
            </p>
            <p className="mt-1 text-sm font-bold text-[#7dd3fc] md:text-base">
              Games {theirGames}
            </p>
            <p className="mt-4 font-display text-[clamp(7rem,22vw,20rem)] font-black leading-none text-[#f8fafc]">
              {pointDisplay(theirPoints)}
            </p>
          </div>
        </div>

        <div className="gesture-score-pad__actions mx-auto grid w-full max-w-7xl grid-cols-4 gap-2 py-3 md:gap-4 md:py-5">
          <button
            type="button"
            onClick={onWin}
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-full border border-[#34d399]/45 bg-[#34d399]/15 px-1 py-3 text-[#34d399] shadow-xl shadow-black/25 active:scale-[0.96] md:flex-row md:gap-5 md:px-7 md:py-7"
            aria-label="Thumbs up — point for our team"
          >
            <FingerCountIcon count={1} />
            <span className="text-[11px] font-black uppercase tracking-wide md:text-4xl">Win</span>
          </button>
          <button
            type="button"
            onClick={onLose}
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-full border border-[#60a5fa]/45 bg-[#60a5fa]/15 px-1 py-3 text-[#60a5fa] shadow-xl shadow-black/25 active:scale-[0.96] md:flex-row md:gap-5 md:px-7 md:py-7"
            aria-label="Thumbs down — point for other team"
          >
            <FingerCountIcon count={2} />
            <span className="text-[11px] font-black uppercase tracking-wide md:text-4xl">Lose</span>
          </button>
          <button
            type="button"
            disabled={undoDisabled}
            onClick={onUndo}
            className="relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full border border-white/10 bg-[#11355c]/80 px-1 py-3 text-white/30 opacity-50 shadow-xl shadow-black/25 active:scale-[0.96] md:flex-row md:gap-5 md:px-7 md:py-7"
            aria-label="Undo last score action"
          >
            <span className="opacity-40 grayscale">
              <FingerCountIcon count={3} />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wide md:text-2xl">Undo</span>
          </button>
          <button
            type="button"
            disabled={!onReset}
            onClick={onReset}
            className="relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full border border-white/10 bg-[#11355c]/80 px-1 py-3 text-white/30 opacity-50 shadow-xl shadow-black/25 active:scale-[0.96] md:flex-row md:gap-5 md:px-7 md:py-7"
            aria-label="Reset score"
            title={!onReset ? 'Use Undo to correct linked scores' : undefined}
          >
            <span className="opacity-40 grayscale">
              <FingerCountIcon count={4} />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wide md:text-2xl">Reset</span>
          </button>
        </div>

        <div className="gesture-score-pad__messages relative flex min-h-0 items-center justify-center">
          {error ? (
            <p className="mx-auto max-w-xl rounded-lg border border-[#60a5fa]/45 bg-[#60a5fa]/15 px-3 py-2 text-center text-sm font-bold text-[#60a5fa]">
              {error}
            </p>
          ) : null}
          {status === 'unsupported' ? (
            <p className="mx-auto max-w-xl rounded-lg border border-[#fbbf24]/45 bg-[#fbbf24]/15 px-3 py-2 text-center text-sm font-bold text-[#fde68a]">
              Camera access is not available from this page.
            </p>
          ) : null}
        </div>
      </section>
      <button
        type="button"
        onClick={goBack}
        className="gesture-score-pad__back fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-[430] flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#11355c] text-[#f8fafc] active:scale-[0.98] md:h-10 md:w-10"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5 stroke-[3]" aria-hidden />
      </button>
    </main>
  )
}
