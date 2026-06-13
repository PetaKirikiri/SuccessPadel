type Props = { className?: string }

/** Mini court + shot stroke — opens gesture score tracker (wired by parent). */
export function ScoreTrackerIcon({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="5"
        width="17"
        height="14"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M7.5 16V8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.35" />
      <path
        d="M8.5 15.5 Q12 9.5 16.5 11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="15.5" r="1.25" fill="currentColor" />
    </svg>
  )
}
