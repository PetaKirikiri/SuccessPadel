import { useRef } from 'react'
import { ArrowLeft, BarChart3, RotateCcw } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'

const ISLAND_BTN =
  'pointer-events-auto flex h-11 w-11 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#1a5fa8]/85 text-white/55 transition active:scale-95 md:h-12 md:w-12'

const RESET_HOLD_MS = 600

type Props = {
  onBack: () => void
  backLabel: string
  onUndo?: () => void
  onResetGame?: () => void
  resetLabel?: string
  onStats?: () => void
  competitionId?: string
  gameNumber?: string
}

export function GesturePadDashboard({
  onBack,
  backLabel,
  onUndo,
  onResetGame,
  resetLabel,
  onStats,
}: Props) {
  const { t } = useTranslation()
  const resetText = resetLabel ?? t('pad.dashboard.reset')
  const undoText = t('pad.dashboard.undo')
  const backText = backLabel.replace(/^←\s*/, '')
  const holdTimerRef = useRef<number | null>(null)
  const holdFiredRef = useRef(false)

  const cancelHold = () => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const startHold = () => {
    if (!onResetGame) return
    holdFiredRef.current = false
    cancelHold()
    holdTimerRef.current = window.setTimeout(() => {
      holdFiredRef.current = true
      onResetGame()
    }, RESET_HOLD_MS)
  }

  const handleUndoClick = () => {
    if (holdFiredRef.current) {
      holdFiredRef.current = false
      return
    }
    if (!onUndo) return
    if (!window.confirm(t('pad.dashboard.undoConfirm'))) return
    onUndo()
  }

  return (
    <nav
      className="gesture-pad-dashboard pointer-events-none fixed right-[max(0.5rem,env(safe-area-inset-right))] top-1/2 z-[420] flex -translate-y-1/2 flex-col gap-1.5"
      aria-label={t('pad.dashboard.controlsAria')}
    >
      <button
        type="button"
        onClick={onBack}
        className={ISLAND_BTN}
        title={backText}
        aria-label={backText}
      >
        <ArrowLeft className="h-5 w-5 md:h-[1.35rem] md:w-[1.35rem]" strokeWidth={2.75} aria-hidden />
      </button>
      {onUndo || onResetGame ? (
        <button
          type="button"
          onClick={handleUndoClick}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          className={ISLAND_BTN}
          title={onResetGame ? `${undoText} · ${resetText}` : undoText}
          aria-label={undoText}
        >
          <RotateCcw className="h-5 w-5 md:h-[1.35rem] md:w-[1.35rem]" strokeWidth={2.75} aria-hidden />
        </button>
      ) : null}
      {onStats ? (
        <button
          type="button"
          onClick={onStats}
          className={ISLAND_BTN}
          title={t('pad.dashboard.stats')}
          aria-label={t('pad.dashboard.stats')}
        >
          <BarChart3 className="h-5 w-5 md:h-[1.35rem] md:w-[1.35rem]" strokeWidth={2.75} aria-hidden />
        </button>
      ) : null}
    </nav>
  )
}
