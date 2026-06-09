import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { readGestureDebugLog } from '../lib/gestureDebugLog'
import { countGestureShots, countShotGuideTabs } from '../lib/gestureHelpCounts'
import {
  GESTURE_SHOT_TYPE_ORDER,
  GESTURE_SHOT_TYPES,
  type GestureShotTypeId,
} from '../lib/gestureShotTypes'

function GestureDiagram({
  label,
  imageSrc,
  detail,
  count,
}: {
  label: string
  imageSrc: string
  detail: string
  count: number
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-brand-border/70 bg-brand-surface/80 p-3">
      <div className="mb-2 flex w-full items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold text-brand-primary">{label}</p>
        {count > 0 ? (
          <span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-xs font-bold tabular-nums text-brand-accent">
            {count}
          </span>
        ) : null}
      </div>
      <img
        src={imageSrc}
        alt=""
        className="h-32 w-32 rounded-xl bg-[#e8f2fb] ring-1 ring-brand-border/50 sm:h-36 sm:w-36"
      />
      <p className="mt-3 text-center text-xs leading-snug text-brand-muted sm:text-sm">{detail}</p>
    </div>
  )
}

type Props = {
  onClose: () => void
  competitionId?: string
  gameNumber?: string
}

export function GestureHelpModal({ onClose, competitionId, gameNumber }: Props) {
  const [tab, setTab] = useState<GestureShotTypeId>('overhead')
  const filter = useMemo(
    () => ({ competitionId, gameNumber }),
    [competitionId, gameNumber],
  )
  const tabCounts = useMemo(
    () => countShotGuideTabs(readGestureDebugLog(), filter),
    [filter],
  )
  const total = useMemo(
    () => Object.values(countGestureShots(readGestureDebugLog(), filter)).reduce((sum, n) => sum + n, 0),
    [filter],
  )
  const shot = GESTURE_SHOT_TYPES[tab]
  const row = tabCounts[tab]
  const tabTotal = row.win + row.foul

  return createPortal(
    <div
      className="fixed inset-0 z-[450] flex items-end justify-center bg-black/55 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-6 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        data-scroll-y
        className="scroll-y flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto rounded-2xl bg-brand-surface p-4 shadow-xl sm:max-h-[90vh] sm:p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="gesture-help-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="gesture-help-title" className="font-display text-xl font-semibold text-brand-primary">
              Gesture shots
            </h2>
            <p className="mt-1 text-sm leading-snug text-brand-muted">
              Start on a player (green). Finish higher for a win; finish lower for a foul (yellow).
            </p>
            <p className="mt-1.5 text-sm font-medium text-brand-text">
              {total} noticed {total === 1 ? 'gesture' : 'gestures'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full px-2 py-1 text-xl leading-none text-brand-muted"
          >
            ✕
          </button>
        </div>

        <div
          className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-brand-border/70 bg-brand-bg/40 p-1"
          role="tablist"
          aria-label="Shot types"
        >
          {GESTURE_SHOT_TYPE_ORDER.map((id) => {
            const selected = tab === id
            const count = tabCounts[id].win + tabCounts[id].foul
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(id)}
                className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
                  selected
                    ? 'bg-brand-surface text-brand-primary shadow-sm'
                    : count > 0
                      ? 'text-brand-primary/80 hover:bg-brand-surface/60'
                      : 'text-brand-muted hover:bg-brand-surface/40'
                }`}
              >
                {GESTURE_SHOT_TYPES[id].tabLabel}
                {count > 0 ? (
                  <span className="ml-1 tabular-nums text-[10px] opacity-75">({count})</span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div role="tabpanel" aria-label={shot.label} className="space-y-4">
          <div>
            <p className="font-display text-lg font-semibold text-brand-primary">{shot.label}</p>
            <p className="mt-1 text-sm leading-snug text-brand-muted">{shot.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <GestureDiagram
              label="Going up"
              imageSrc={shot.winImageSrc}
              detail={shot.winDetail}
              count={row.win}
            />
            <GestureDiagram
              label="Going down"
              imageSrc={shot.foulImageSrc}
              detail={shot.foulDetail}
              count={row.foul}
            />
          </div>

          {tabTotal === 0 ? (
            <p className="text-center text-sm text-brand-muted">
              No {shot.label.toLowerCase()} gestures noticed this game yet
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
