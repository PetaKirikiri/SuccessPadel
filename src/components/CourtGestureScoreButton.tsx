import { useNavigate } from 'react-router-dom'
import { ScoreTrackerIcon } from './ScoreTrackerIcon'

type Props = {
  href: string
  live?: boolean
  ariaLabel?: string
}

export function CourtGestureScoreButton({ href, live = false, ariaLabel = 'Live gesture scoring' }: Props) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={(e) => {
        e.stopPropagation()
        navigate(href)
      }}
      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-accent/40 bg-brand-bg-alt text-brand-accent shadow-sm transition active:scale-95 dark:border-brand-accent/35 dark:bg-white/10 dark:text-brand-accent-light"
    >
      <ScoreTrackerIcon className="h-4 w-4" />
      {live ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-surface bg-emerald-400 dark:border-[#0b2a4a]"
          aria-hidden
        />
      ) : null}
    </button>
  )
}
