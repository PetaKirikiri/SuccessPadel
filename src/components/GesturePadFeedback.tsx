import type { GestureAnalysis } from '../lib/gestureAnalysis'
import { detectGestureShape } from '../lib/gestureAnalysis'
import type { NormalizedPoint } from '../lib/gestureCapture'

type Props = {
  isDrawing: boolean
  livePath: NormalizedPoint[]
  liveCode: string | null
  lastGesture: { code: string } | null
  lastAnalysis: GestureAnalysis | null
  pulse: boolean
  logCount: number
  onOpenLog: () => void
}

function liveShapeHint(path: NormalizedPoint[]): string | null {
  if (path.length < 3) return null
  const shape = detectGestureShape(path)
  if (shape === 'SMASH') return 'Smash…'
  if (shape === 'LINE_V') return 'Vertical…'
  if (shape === 'LINE_H') return 'Horizontal…'
  return null
}

export function GesturePadFeedback({
  isDrawing,
  livePath,
  liveCode,
  lastGesture,
  lastAnalysis,
  pulse,
  logCount,
  onOpenLog,
}: Props) {
  const liveHint = isDrawing ? liveShapeHint(livePath) : null
  const showSmash = lastAnalysis?.shape === 'SMASH'

  return (
    <div className="gesture-pad-feedback flex shrink-0 items-center justify-between gap-3 border-t border-brand-border bg-brand-surface px-3 py-2 landscape:py-2.5 landscape:pl-[max(0.75rem,env(safe-area-inset-left))] landscape:pr-[max(0.75rem,env(safe-area-inset-right))] landscape:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className={`min-w-0 flex-1 transition-transform ${pulse ? 'scale-[1.02]' : ''}`}>
        {isDrawing ? (
          <div>
            {liveHint ? (
              <p className="font-display text-xl font-bold leading-none text-brand-accent landscape:text-2xl">
                {liveHint}
              </p>
            ) : liveCode ? (
              <p className="font-display text-xl font-bold leading-none tabular-nums text-brand-primary landscape:text-2xl">
                {liveCode}
              </p>
            ) : (
              <p className="text-xs text-brand-muted">Drawing…</p>
            )}
            {liveCode && liveHint ? (
              <p className="mt-0.5 font-mono text-[10px] tabular-nums text-brand-muted landscape:text-xs">
                {liveCode}
              </p>
            ) : null}
          </div>
        ) : lastGesture ? (
          <div>
            {showSmash ? (
              <p
                className={`font-display text-2xl font-bold leading-none text-brand-accent landscape:text-3xl ${
                  pulse ? 'scale-105' : ''
                }`}
              >
                Smash
              </p>
            ) : lastAnalysis ? (
              <p className="font-display text-xl font-bold leading-none text-brand-primary landscape:text-2xl">
                {lastAnalysis.shapeLabel}
              </p>
            ) : null}
            <p
              className={`mt-0.5 font-display text-lg font-bold tabular-nums text-brand-primary landscape:text-xl ${
                showSmash ? 'text-brand-muted' : ''
              }`}
            >
              {lastGesture.code}
            </p>
            {lastAnalysis ? (
              <p className="mt-0.5 truncate font-mono text-[10px] text-brand-muted landscape:text-xs">
                Δx {lastAnalysis.xSpread} · Δy {lastAnalysis.ySpread} · straight{' '}
                {lastAnalysis.straightness}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-brand-muted landscape:text-sm">Draw a straight vertical line for smash</p>
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
