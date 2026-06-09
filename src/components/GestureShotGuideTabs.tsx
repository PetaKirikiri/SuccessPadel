import { useState } from 'react'
import {
  GESTURE_SHOT_TYPE_ORDER,
  GESTURE_SHOT_TYPES,
  type GestureShotTypeId,
} from '../lib/gestureShotTypes'

type Props = {
  className?: string
  compact?: boolean
}

export function GestureShotGuideTabs({ className = '', compact = false }: Props) {
  const [tab, setTab] = useState<GestureShotTypeId>('overhead')
  const shot = GESTURE_SHOT_TYPES[tab]
  const imageClass = compact
    ? 'h-11 w-11 landscape:h-12 landscape:w-12'
    : 'h-12 w-12 portrait:h-14 portrait:w-14'

  return (
    <div className={className}>
      <div
        className="flex gap-1 overflow-x-auto rounded-lg border border-brand-border/60 bg-brand-bg/40 p-0.5"
        role="tablist"
        aria-label="Shot types"
      >
        {GESTURE_SHOT_TYPE_ORDER.map((id) => {
          const selected = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold transition portrait:px-2.5 portrait:py-1.5 portrait:text-[11px] landscape:text-[10px] ${
                selected
                  ? 'bg-brand-surface text-brand-primary shadow-sm'
                  : 'text-brand-muted hover:bg-brand-surface/60'
              }`}
            >
              {GESTURE_SHOT_TYPES[id].tabLabel}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" aria-label={shot.label} className="mt-2 space-y-1.5">
        <p className="text-[10px] leading-snug text-brand-muted portrait:text-[11px] landscape:text-[10px]">
          {shot.summary}
        </p>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <img
              src={shot.winImageSrc}
              alt=""
              className={`rounded-lg bg-[#e8f2fb] ring-1 ring-brand-border/50 ${imageClass}`}
            />
            <p className="mt-1 text-[10px] font-medium text-brand-accent portrait:text-[11px]">
              Up
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <img
              src={shot.foulImageSrc}
              alt=""
              className={`rounded-lg bg-[#e8f2fb] ring-1 ring-brand-border/50 ${imageClass}`}
            />
            <p className="mt-1 text-[10px] font-medium text-red-600/90 portrait:text-[11px]">
              Down
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
