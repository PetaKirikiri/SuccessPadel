import type { GestureAnalysis } from '../lib/gestureAnalysis'
import {
  detectBackhandDirection,
  detectGestureShape,
  detectSmashVerdict,
  gestureReport,
} from '../lib/gestureAnalysis'
import { playerLabel, quadrantFromPoint, type NormalizedPoint } from '../lib/gestureCapture'

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
  const start = quadrantFromPoint(path[0]!)
  const end = path[path.length - 1]!
  const shape = detectGestureShape(path)
  const report = gestureReport(start, shape, {
    smashVerdict: shape === 'SMASH' ? detectSmashVerdict(path[0]!, end) : null,
    backhandDirection: shape === 'BACKHAND' ? detectBackhandDirection(path[0]!, end) : null,
  })
  if (shape === 'SMASH' || shape === 'BACKHAND') return `${report}…`
  return playerLabel(start)
}

function reportTone(report: string | null | undefined): string {
  if (!report) return 'text-brand-primary'
  if (report.includes('Foul')) return 'text-red-600'
  if (report.includes('Win') || report.includes('Smash') || report.includes('Backhand')) {
    return 'text-brand-accent'
  }
  return 'text-brand-primary'
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
  const reportLabel = lastAnalysis?.report ?? null
  const liveTone = reportTone(liveLabel)
  const resultTone = reportTone(reportLabel)
  const showPulse = pulse && Boolean(reportLabel?.includes('Smash') || reportLabel?.includes('Backhand'))

  return (
    <div className="gesture-pad-feedback flex shrink-0 flex-col gap-2 border-t border-brand-border bg-brand-surface px-3 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] portrait:min-h-[7rem] portrait:gap-3 portrait:px-4 portrait:pt-4 landscape:flex-row landscape:items-center landscape:justify-between landscape:gap-3 landscape:py-2.5 landscape:pl-[max(0.75rem,env(safe-area-inset-left))] landscape:pr-[max(0.75rem,env(safe-area-inset-right))] landscape:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className={`min-w-0 flex-1 transition-transform ${pulse ? 'scale-[1.02]' : ''}`}>
        {isDrawing ? (
          <p
            className={`font-display text-xl font-bold leading-snug portrait:text-2xl landscape:text-2xl ${liveTone}`}
          >
            {liveLabel ?? 'Drawing…'}
          </p>
        ) : reportLabel ? (
          <div className="space-y-1">
            <p
              className={`font-display text-2xl font-bold leading-snug portrait:text-3xl landscape:text-3xl ${resultTone} ${
                showPulse ? 'scale-105' : ''
              }`}
            >
              {reportLabel}
            </p>
            <p className="hidden font-mono text-[10px] text-brand-muted landscape:block landscape:text-xs">
              Δx {lastAnalysis!.xSpread} · Δy {lastAnalysis!.ySpread} · straight{' '}
              {lastAnalysis!.straightness}
            </p>
          </div>
        ) : (
          <div className="space-y-1 text-xs leading-relaxed text-brand-muted portrait:text-sm landscape:text-sm">
            <p>Smash up from bottom = Win · smash down from top = Foul</p>
            <p>Backhand left→right or right→left across the court</p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onOpenLog}
        className="shrink-0 self-end rounded-lg border border-brand-border px-3 py-1.5 text-[10px] font-semibold text-brand-primary portrait:py-2 portrait:text-xs landscape:text-xs"
      >
        Log ({logCount})
      </button>
    </div>
  )
}
