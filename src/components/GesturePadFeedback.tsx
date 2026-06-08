import type { GestureAnalysis } from '../lib/gestureAnalysis'
import {
  detectGestureShape,
  detectSmashVerdict,
  gestureReport,
} from '../lib/gestureAnalysis'
import { quadrantFromPoint, type NormalizedPoint } from '../lib/gestureCapture'

type Props = {
  isDrawing: boolean
  livePath: NormalizedPoint[]
  lastAnalysis: GestureAnalysis | null
  pulse: boolean
  logCount: number
  onOpenLog: () => void
}

function liveReport(path: NormalizedPoint[]): string | null {
  if (path.length < 2) return null
  const start = quadrantFromPoint(path[0])
  const end = path[path.length - 1]!
  const shape = detectGestureShape(path)
  const verdict = shape === 'SMASH' ? detectSmashVerdict(path[0]!, end) : null
  const report = gestureReport(start, shape, verdict)
  if (shape === 'SMASH') return `${report}…`
  return start
}

export function GesturePadFeedback({
  isDrawing,
  livePath,
  lastAnalysis,
  pulse,
  logCount,
  onOpenLog,
}: Props) {
  const liveLabel = isDrawing ? liveReport(livePath) : null
  const verdict = lastAnalysis?.smashVerdict
  const isSmashWin = verdict === 'WIN'
  const isSmashFoul = verdict === 'FOUL'
  const smashTone = isSmashFoul
    ? 'text-red-600'
    : isSmashWin
      ? 'text-brand-accent'
      : 'text-brand-primary'
  const liveTone = liveLabel?.includes('Foul')
    ? 'text-red-600'
    : liveLabel?.includes('Smash')
      ? 'text-brand-accent'
      : 'text-brand-primary'

  return (
    <div className="gesture-pad-feedback flex shrink-0 items-center justify-between gap-3 border-t border-brand-border bg-brand-surface px-3 py-2 landscape:py-2.5 landscape:pl-[max(0.75rem,env(safe-area-inset-left))] landscape:pr-[max(0.75rem,env(safe-area-inset-right))] landscape:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className={`min-w-0 flex-1 transition-transform ${pulse ? 'scale-[1.02]' : ''}`}>
        {isDrawing ? (
          <p
            className={`font-display text-xl font-bold leading-none tabular-nums landscape:text-2xl ${liveTone}`}
          >
            {liveLabel ?? 'Drawing…'}
          </p>
        ) : lastAnalysis ? (
          <div>
            <p
              className={`font-display text-2xl font-bold leading-none tabular-nums landscape:text-3xl ${smashTone} ${
                pulse && (isSmashWin || isSmashFoul) ? 'scale-105' : ''
              }`}
            >
              {lastAnalysis.report}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-brand-muted landscape:text-xs">
              Δx {lastAnalysis.xSpread} · Δy {lastAnalysis.ySpread} · straight{' '}
              {lastAnalysis.straightness}
            </p>
          </div>
        ) : (
          <p className="text-xs text-brand-muted landscape:text-sm">
            Smash up from bottom = Win · smash down from top = Foul
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onOpenLog}
        className="shrink-0 rounded-lg border border-brand-border px-2.5 py-1 text-[10px] font-semibold text-brand-primary landscape:text-xs"
      >
        Log ({logCount})
      </button>
    </div>
  )
}
