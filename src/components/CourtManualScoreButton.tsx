import { useNavigate } from 'react-router-dom'
import { ChevronsUpDown } from 'lucide-react'

type Props = {
  href: string
  ariaLabel?: string
}

export function CourtManualScoreButton({
  href,
  ariaLabel = 'Manual score entry',
}: Props) {
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
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-accent/40 bg-brand-bg-alt text-brand-accent shadow-sm transition active:scale-95 dark:border-brand-accent/35 dark:bg-white/10 dark:text-brand-accent-light"
    >
      <ChevronsUpDown className="h-4 w-4" strokeWidth={2.25} aria-hidden />
    </button>
  )
}
