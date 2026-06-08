import type { GestureAnalysis } from '../lib/gestureAnalysis'
import { detectGestureShape, gestureReport } from '../lib/gestureAnalysis'
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
  const shape = detectGestureShape(path)
  const report = gestureReport(start, shape)
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
  const isSmash = lastAnalysis?.shape === 'SMASH'

  return (
    <div className="gesture-pad-feedback flex shrink-0 items-center justify-between gap-3 border-t border-brand-border bg-brand-surface px-3 py-2 landscape:py-2.5 landscape:pl-[max(0.75rem,env(safe-area-inset-left))] landscape:pr-[max(0.75rem,env(safe-area-inset-right))] landscape:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className={`min-w-0 flex-1 transition-transform ${pulse ? 'scale-[1.02]' : ''}`}>
        {isDrawing ? (
          <p
            className={`font-display text-xl font-bold leading-none tabular-nums landscape:text-2xl ${
              liveLabel?.includes('Smash') ? 'text-brand-accent' : 'text-brand-primary'
            }`}
          >
            {liveLabel ?? 'Drawing…'}
          </p>
        ) : lastAnalysis ? (
          <div>
            <p
              className={`font-display text-2xl font-bold leading-none tabular-nums landscape:text-3xl ${
                isSmash ? 'text-brand-accent' : 'text-brand-primary'
              } ${pulse && isSmash ? 'scale-105' : ''}`}
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
            Draw a straight vertical line — e.g. TR - Smash
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
