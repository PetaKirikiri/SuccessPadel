import { gestureReport, gestureShotLabel } from '../lib/gestureAnalysis'
import type { GestureDebugEntry } from '../lib/gestureDebugLog'
import type { MatchPointEvent } from '../lib/matchSessionLog'
import type { Quadrant } from '../lib/gestureCapture'

type Props = {
  reviewIndex: number | 'live'
  totalPoints: number
  event: MatchPointEvent | null
  gestures: GestureDebugEntry[]
  playerNames?: Partial<Record<Quadrant, string>>
  onBack: () => void
  onForward: () => void
  onOverwrite: () => void
}

export function pointNavState(reviewIndex: number | 'live', totalPoints: number) {
  const atLive = reviewIndex === 'live'
  return {
    atLive,
    pointNum: atLive ? totalPoints : reviewIndex + 1,
    canBack: totalPoints > 0 && (atLive || reviewIndex > 0),
    canForward: !atLive,
    caption: atLive ? undefined : `Point ${reviewIndex + 1}/${totalPoints}`,
  }
}

const navBtnClass =
  'flex w-11 shrink-0 items-center justify-center self-stretch border-white/25 bg-black/30 text-xl font-semibold text-white transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35 sm:w-14 sm:text-2xl'

export function PointNavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'back' | 'forward'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`${navBtnClass} ${direction === 'back' ? 'border-r' : 'border-l'}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === 'back' ? 'Previous point' : 'Next point'}
    >
      {direction === 'back' ? '←' : '→'}
    </button>
  )
}

function shotLine(entry: GestureDebugEntry | undefined, playerNames?: Partial<Record<Quadrant, string>>) {
  if (!entry) return null
  return (
    gestureShotLabel(entry.shape, {
      smashVerdict: entry.smashVerdict,
      lobVerdict: entry.lobVerdict,
      volleyVerdict: entry.volleyVerdict,
      startQuadrant: entry.startQuadrant,
      start: entry.start,
      end: entry.end,
    }) ??
    gestureReport(entry.startQuadrant, entry.shape, {
      smashVerdict: entry.smashVerdict,
      lobVerdict: entry.lobVerdict,
      volleyVerdict: entry.volleyVerdict,
      playerNames,
      startQuadrant: entry.startQuadrant,
      start: entry.start,
      end: entry.end,
    })
  )
}

export function PointEventNavigator({
  reviewIndex,
  totalPoints,
  event,
  gestures,
  playerNames,
  onOverwrite,
}: Omit<Props, 'onBack' | 'onForward'>) {
  const { atLive } = pointNavState(reviewIndex, totalPoints)

  if (atLive || !event) return null

  const winG = gestures.find((g) => g.id === event.winnerGestureId)
  const loseG =
    event.loserGestureId && event.loserGestureId !== event.winnerGestureId
      ? gestures.find((g) => g.id === event.loserGestureId)
      : undefined
  const winLabel = shotLine(winG, playerNames)
  const loseLabel = shotLine(loseG, playerNames)

  return (
    <div className="pointer-events-auto w-full max-w-md rounded-xl border border-white/25 bg-black/45 px-3 py-2 text-center backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
        Team {event.winner.toUpperCase()} won · {event.isServe ? 'serve' : 'rally'}
      </p>
      {winLabel ? <p className="mt-1 text-xs font-medium text-emerald-200">Win: {winLabel}</p> : null}
      {loseLabel ? <p className="mt-0.5 text-xs font-medium text-rose-200">Loss: {loseLabel}</p> : null}
      {!winLabel && !loseLabel ? <p className="mt-1 text-xs text-white/70">Gestures not in log</p> : null}
      <button
        type="button"
        onClick={onOverwrite}
        className="mt-2 w-full rounded-lg border border-amber-200/40 bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100"
      >
        Overwrite from here
      </button>
    </div>
  )
}
