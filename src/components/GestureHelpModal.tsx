import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { readGestureDebugLog } from '../lib/gestureDebugLog'
import {
  countGestureShots,
  type ShotCategoryId,
} from '../lib/gestureHelpCounts'

type ShotGuide = {
  id: ShotCategoryId
  title: string
  detail: string
  diagram: ReactNode
}

function MiniCourt({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-14 w-14 shrink-0 rounded-lg bg-[#e8f2fb] ring-1 ring-brand-border/50"
      aria-hidden
    >
      <rect x="1" y="1" width="46" height="46" rx="2" fill="#1a5fa8" fillOpacity="0.08" />
      <line x1="24" y1="2" x2="24" y2="46" stroke="#94a3b8" strokeWidth="0.6" />
      <line x1="2" y1="24" x2="46" y2="24" stroke="#94a3b8" strokeWidth="0.6" />
      {children}
    </svg>
  )
}

const strokeProps = {
  fill: 'none',
  stroke: '#b85a1e',
  strokeWidth: 2.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function GesturePath({
  d,
  sx,
  sy,
  ex,
  ey,
}: {
  d: string
  sx: number
  sy: number
  ex: number
  ey: number
}) {
  return (
    <MiniCourt>
      <circle cx={sx} cy={sy} r="3" fill="#6ee7b7" />
      <path d={d} {...strokeProps} />
      <circle cx={ex} cy={ey} r="2.5" fill="#fde68a" />
    </MiniCourt>
  )
}

const GESTURE_SHOTS: ShotGuide[] = [
  {
    id: 'smash-score',
    title: 'Smash — score',
    detail: 'Straight line up from a player.',
    diagram: <GesturePath d="M14 36 L14 10" sx={14} sy={36} ex={14} ey={10} />,
  },
  {
    id: 'smash-foul',
    title: 'Smash — foul',
    detail: 'Straight line down from a player.',
    diagram: <GesturePath d="M34 12 L34 38" sx={34} sy={12} ex={34} ey={38} />,
  },
  {
    id: 'backhand-lr-score',
    title: 'Backhand L→R — score',
    detail: 'Start left, end right — L-shape along right, then finish up.',
    diagram: <GesturePath d="M10 36 L30 36 L30 10" sx={10} sy={36} ex={30} ey={10} />,
  },
  {
    id: 'backhand-lr-foul',
    title: 'Backhand L→R — foul',
    detail: 'Start left, end right — L-shape along right, then finish lower.',
    diagram: <GesturePath d="M10 36 L30 36 L30 42" sx={10} sy={36} ex={30} ey={42} />,
  },
  {
    id: 'forehand-score',
    title: 'Forehand R→L — score',
    detail: 'Start right, end left — L-shape along left, then finish up.',
    diagram: <GesturePath d="M38 36 L18 36 L18 10" sx={38} sy={36} ex={18} ey={10} />,
  },
  {
    id: 'forehand-foul',
    title: 'Forehand R→L — foul',
    detail: 'Start right, end left — L-shape along left, then finish lower.',
    diagram: <GesturePath d="M38 36 L18 36 L18 42" sx={38} sy={36} ex={18} ey={42} />,
  },
  {
    id: 'volley-score',
    title: 'Volley — score',
    detail: 'L-shape from low: first leg, then finish up.',
    diagram: <GesturePath d="M12 36 L12 24 L32 10" sx={12} sy={36} ex={32} ey={10} />,
  },
  {
    id: 'volley-foul',
    title: 'Volley — foul',
    detail: 'L-shape from low: first leg, then finish lower.',
    diagram: <GesturePath d="M12 36 L12 24 L34 42" sx={12} sy={36} ex={34} ey={42} />,
  },
  {
    id: 'unregistered',
    title: 'Unregistered',
    detail: 'Drawn on the court but not matched to a known shot.',
    diagram: (
      <MiniCourt>
        <circle cx="24" cy="24" r="3" fill="#94a3b8" />
        <path d="M14 32 L22 18 L34 28" {...strokeProps} stroke="#94a3b8" strokeDasharray="3 2" />
      </MiniCourt>
    ),
  },
]

function CountBadge({ count }: { count: number }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
        count > 0 ? 'bg-brand-accent/15 text-brand-accent' : 'bg-brand-bg-alt text-brand-muted'
      }`}
    >
      {count}
    </span>
  )
}

type Props = {
  onClose: () => void
  competitionId?: string
  gameNumber?: string
}

export function GestureHelpModal({ onClose, competitionId, gameNumber }: Props) {
  const counts = useMemo(
    () =>
      countGestureShots(readGestureDebugLog(), {
        competitionId,
        gameNumber,
      }),
    [competitionId, gameNumber],
  )

  const total = useMemo(() => Object.values(counts).reduce((sum, n) => sum + n, 0), [counts])

  return createPortal(
    <div
      className="fixed inset-0 z-[450] flex items-end justify-center bg-black/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        data-scroll-y
        className="scroll-y max-h-[78vh] w-full max-w-md overflow-y-auto rounded-2xl bg-brand-surface p-4 shadow-xl sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="gesture-help-title"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="gesture-help-title" className="font-display text-lg font-semibold text-brand-primary">
              Gesture shots
            </h2>
            <p className="mt-0.5 text-xs leading-snug text-brand-muted">
              Start on a player (green). Finish higher for a score; finish lower for a foul (yellow).
              Counts are gestures noticed this game.
            </p>
            <p className="mt-1 text-xs font-medium text-brand-text">
              {total} noticed {total === 1 ? 'gesture' : 'gestures'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full px-2 py-1 text-lg leading-none text-brand-muted"
          >
            ✕
          </button>
        </div>
        <ul className="m-0 list-none space-y-3 p-0">
          {GESTURE_SHOTS.map((shot) => (
            <li
              key={shot.id}
              className="flex items-center gap-3 rounded-xl border border-brand-border/70 bg-brand-bg/60 px-3 py-2.5"
            >
              {shot.diagram}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-semibold text-brand-primary">{shot.title}</p>
                  <CountBadge count={counts[shot.id]} />
                </div>
                <p className="mt-0.5 text-xs leading-snug text-brand-muted">{shot.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
