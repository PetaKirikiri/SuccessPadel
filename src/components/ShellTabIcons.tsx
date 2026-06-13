type IconProps = { className?: string }

export function shellTabClass(active: boolean, variant: 'rank' | 'competition' = 'competition') {
  return `game-tab min-w-0 flex-1 basis-0 gap-1 game-tab-${variant}${active ? ' game-tab-selected' : ''}`
}

export function IconHubCurrent({ className = 'game-tab-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 9h16M9 5v14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function IconHubPast({ className = 'game-tab-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function IconHubLeaderboard({ className = 'game-tab-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-10 0V4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 6H4.5A2.5 2.5 0 0 0 7 10M17 6h2.5A2.5 2.5 0 0 1 17 10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconPlayGames({ className = 'game-tab-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5.5h14M5 12h14M5 18.5h14M8 3.5v17M16 3.5v17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconProfile({ className = 'game-tab-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconFriendly({ className = 'game-tab-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" opacity="0.2" />
      <path
        d="M3 12h18M12 5v14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="9" r="1.25" fill="currentColor" />
      <circle cx="16" cy="15" r="1.25" fill="currentColor" />
    </svg>
  )
}

export function IconCompetition({ className = 'game-tab-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M7 4h10v2.8a5 5 0 0 1-10 0V4z" fill="currentColor" opacity="0.28" />
      <path
        d="M7 4h10v2.8a5 5 0 0 1-10 0V4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 11.5V14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M9.25 14h5.5l.75 6.5H8.5l.75-6.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 4H3v1.2a3.2 3.2 0 0 0 2.6 3.1M19.5 4H21v1.2a3.2 3.2 0 0 1-2.6 3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
