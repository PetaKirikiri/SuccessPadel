import { useMemo, useRef, useState } from 'react'
import { gestureShotLabel } from '../lib/gestureAnalysis'
import type { GestureDebugEntry } from '../lib/gestureDebugLog'
import { buildGameLogTimeline, serveGestureLabel } from '../lib/gameLogTimeline'
import type { MatchPointEvent } from '../lib/matchSessionLog'
import { rallyShotsFromReport, type RallyWheelShot } from '../lib/rallyShotWheel'
import {
  gestureAttackerText,
  gestureDefenderText,
} from '../lib/gestureRoleColors'
import { formatGameScore } from '../lib/tennisScore'
import type { Quadrant } from '../lib/gestureCapture'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'

type Props = {
  events: MatchPointEvent[]
  gestures: GestureDebugEntry[]
  playerNames?: Partial<Record<Quadrant, string>>
  reviewIndex: number | 'live'
  onSelectPoint: (index: number | 'live') => void
  /** Long-press a point to reset the match back to that state. */
  onResetToPoint: (index: number) => void
}

const RESET_HOLD_MS = 600

const RALLY_SHOT_KEY: Record<RallyWheelShot, string> = {
  OH: 'pad.gameLog.shotOverhead',
  BH: 'pad.gameLog.shotBackhand',
  FH: 'pad.gameLog.shotForehand',
  L: 'pad.gameLog.shotLob',
}

function playerLabel(
  quadrant: string,
  playerNames?: Partial<Record<Quadrant, string>>,
): string {
  if (!quadrant) return ''
  const name = playerNames?.[quadrant as Quadrant]
  return name ?? quadrant
}

function localizeRallyShot(shot: RallyWheelShot, t: TranslateFn): string {
  return t(RALLY_SHOT_KEY[shot])
}

function gestureShotName(entry: GestureDebugEntry | undefined, t: TranslateFn): string | null {
  if (!entry) return null
  const raw =
    gestureShotLabel(entry.shape, {
      smashVerdict: entry.smashVerdict,
      lobVerdict: entry.lobVerdict,
      volleyVerdict: entry.volleyVerdict,
      startQuadrant: entry.startQuadrant,
      start: entry.start,
      end: entry.end,
    }) ?? entry.shapeLabel
  if (!raw) return null
  if (/lob/i.test(raw)) return t('pad.gameLog.shotLob')
  if (/overhead|volley oh|smash/i.test(raw)) return t('pad.gameLog.shotOverhead')
  if (/backhand|volley bh/i.test(raw)) return t('pad.gameLog.shotBackhand')
  if (/forehand|volley fh/i.test(raw)) return t('pad.gameLog.shotForehand')
  return null
}

function pointPlayerShots(
  event: MatchPointEvent,
  gestures: GestureDebugEntry[],
  t: TranslateFn,
): { winnerShot: string | null; loserShot: string | null } {
  const winG = gestures.find((g) => g.id === event.winnerGestureId)
  const loseG =
    event.loserGestureId && event.loserGestureId !== event.winnerGestureId
      ? gestures.find((g) => g.id === event.loserGestureId)
      : winG

  if (event.isServe && winG?.shapeLabel === 'Serve') {
    return {
      winnerShot: null,
      loserShot: serveGestureLabel(winG, t),
    }
  }

  if (winG?.attackerShot && winG?.defenderShot) {
    return {
      winnerShot: localizeRallyShot(winG.attackerShot, t),
      loserShot: localizeRallyShot(winG.defenderShot, t),
    }
  }

  if (winG?.shape === 'LINE_V' && winG.report) {
    const rally = rallyShotsFromReport(winG.report)
    if (rally) {
      return {
        winnerShot: localizeRallyShot(rally.attacker, t),
        loserShot: localizeRallyShot(rally.defender, t),
      }
    }
  }

  return {
    winnerShot: gestureShotName(winG, t),
    loserShot: gestureShotName(loseG, t),
  }
}

function PlayerRow({
  name,
  shot,
  role,
}: {
  name: string
  shot: string | null
  role: 'attacker' | 'defender'
}) {
  if (!name && !shot) return null
  return (
    <div className="flex items-baseline justify-between gap-1.5">
      <span
        className={`min-w-0 truncate text-[10px] font-semibold leading-tight sm:text-[11px] ${
          role === 'attacker' ? gestureAttackerText : gestureDefenderText
        }`}
      >
        {name || '—'}
      </span>
      {shot ? (
        <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-white/60 sm:text-[11px]">
          {shot}
        </span>
      ) : null}
    </div>
  )
}

export function GesturePadGameLog({
  events,
  gestures,
  playerNames,
  reviewIndex,
  onSelectPoint,
  onResetToPoint,
}: Props) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const holdTimerRef = useRef<number | null>(null)
  const holdFiredRef = useRef(false)
  const timeline = useMemo(
    () => buildGameLogTimeline(gestures, events),
    [gestures, events],
  )

  const cancelHold = () => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const startHold = (index: number) => {
    holdFiredRef.current = false
    cancelHold()
    holdTimerRef.current = window.setTimeout(() => {
      holdFiredRef.current = true
      onResetToPoint(index)
    }, RESET_HOLD_MS)
  }

  const handleClick = (index: number) => {
    if (holdFiredRef.current) {
      holdFiredRef.current = false
      return
    }
    onSelectPoint(index)
  }

  return (
    <aside
      className="gesture-game-log pointer-events-auto flex w-[8.25rem] shrink-0 flex-col items-stretch gap-1 overflow-y-auto overscroll-contain py-1.5 sm:w-36 sm:gap-1.5 sm:py-2"
      aria-label={t('pad.gameLog.aria')}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="sticky top-0 z-10 flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-black/45 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/80 backdrop-blur-sm hover:bg-white/10 sm:text-[11px]"
        aria-expanded={!collapsed}
      >
        <span>{t('pad.gameLog.aria')}</span>
        <span className="text-white/50">{collapsed ? '▸' : '▾'}</span>
      </button>
      {collapsed
        ? null
        : timeline.map((item) => {
        if (item.kind === 'serve_fault') {
          const serverQuad = item.gesture.actorQuadrant ?? item.gesture.startQuadrant
          const serverName = playerLabel(serverQuad, playerNames)
          const faultLabel = serveGestureLabel(item.gesture, t)
          return (
            <div
              key={`fault-${item.gesture.id}`}
              className="relative flex w-full flex-col gap-0.5 rounded-lg border border-white/10 bg-black/20 px-1.5 py-1.5 pl-5 sm:gap-1 sm:px-2 sm:py-2 sm:pl-6"
            >
              <span className="absolute left-1 top-1 text-[9px] font-bold text-white/35 sm:left-1.5 sm:text-[10px]">
                ·
              </span>
              <span className="whitespace-nowrap text-[10px] font-bold tabular-nums text-white/70 sm:text-[11px]">
                {formatGameScore(item.scoreAt)}
              </span>
              <PlayerRow name={serverName} shot={faultLabel} role="defender" />
            </div>
          )
        }

        const { event, pointIndex } = item
        const active = reviewIndex === pointIndex
        const winnerName = playerLabel(event.winnerQuadrant, playerNames)
        const loserQuad =
          event.loserQuadrant && event.loserQuadrant !== event.winnerQuadrant
            ? event.loserQuadrant
            : ''
        const loserName = playerLabel(loserQuad, playerNames)
        const { winnerShot, loserShot } = pointPlayerShots(event, gestures, t)
        return (
          <button
            key={`${event.at}-${event.winnerGestureId}-${pointIndex}`}
            type="button"
            onClick={() => handleClick(pointIndex)}
            onPointerDown={() => startHold(pointIndex)}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            className={`relative flex w-full flex-col gap-0.5 rounded-lg border px-1.5 py-1.5 pl-5 text-left transition touch-none sm:gap-1 sm:px-2 sm:py-2 sm:pl-6 ${
              active
                ? 'border-amber-300/60 bg-amber-500/20'
                : 'border-white/12 bg-black/25 hover:bg-white/10'
            }`}
            title={t('pad.gameLog.reviewHint')}
          >
            <span className="absolute left-1 top-1 text-[9px] font-bold tabular-nums text-white/45 sm:left-1.5 sm:text-[10px]">
              {pointIndex + 1}
            </span>
            <PlayerRow name={winnerName} shot={winnerShot} role="attacker" />
            <span className="whitespace-nowrap text-[10px] font-bold tabular-nums text-white/90 sm:text-[11px]">
              {formatGameScore(event.scoreAfter)}
            </span>
            <PlayerRow name={loserName} shot={loserShot} role="defender" />
          </button>
        )
          })}
      {collapsed ? null : (
        <button
          type="button"
          onClick={() => onSelectPoint('live')}
          className={`w-full rounded-lg border px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide sm:px-2.5 sm:py-2 sm:text-[11px] ${
            reviewIndex === 'live'
              ? 'border-white/25 bg-white/15 text-white'
              : 'border-white/15 bg-black/30 text-white/75 hover:bg-white/10'
          }`}
        >
          {t('pad.gameLog.live')}
        </button>
      )}
    </aside>
  )
}
