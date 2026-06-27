type IconProps = { className?: string }

export function shellTabClass(active: boolean, variant: 'rank' | 'competition' = 'competition') {
  return `game-tab min-w-0 flex-1 basis-0 gap-1 game-tab-${variant}${active ? ' game-tab-selected' : ''}`
}

export function IconHubCurrent({ className = 'game-tab-icon' }: IconProps) {
  return <span className={`${className} css-icon css-icon-current`} aria-hidden />
}

export function IconHubPast({ className = 'game-tab-icon' }: IconProps) {
  return <span className={`${className} css-icon css-icon-clock`} aria-hidden />
}

export function IconHubLeaderboard({ className = 'game-tab-icon' }: IconProps) {
  return <span className={`${className} css-icon css-icon-trophy`} aria-hidden />
}

export function IconPlayGames({ className = 'game-tab-icon' }: IconProps) {
  return <span className={`${className} css-icon css-icon-grid`} aria-hidden />
}

export function IconProfile({ className = 'game-tab-icon' }: IconProps) {
  return <span className={`${className} css-icon css-icon-person`} aria-hidden />
}

export function IconFriendly({ className = 'game-tab-icon' }: IconProps) {
  return (
    <span className={`${className} friendly-smile-icon`} aria-hidden>
      <span className="friendly-smile-eye friendly-smile-eye-left" />
      <span className="friendly-smile-eye friendly-smile-eye-right" />
      <span className="friendly-smile-mouth" />
    </span>
  )
}

export function IconCompetition({ className = 'game-tab-icon' }: IconProps) {
  return <span className={`${className} css-icon css-icon-trophy nav-trophy-icon`} aria-hidden />
}
