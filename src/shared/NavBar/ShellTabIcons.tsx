type IconProps = { className?: string }

const NAV_ICON_SRC = {
  current: '/nav-icons/calendar.png',
  past: '/nav-icons/clock.png',
  leaderboard: '/nav-icons/trophy.png',
  playGames: '/nav-icons/grid.png',
  profile: '/nav-icons/profile.png',
  friendly: '/nav-icons/friendly.png',
  competition: '/nav-icons/trophy.png',
} as const

export function shellTabClass(active: boolean, variant: 'rank' | 'competition' = 'competition') {
  return `game-tab min-w-0 flex-1 basis-0 gap-1 game-tab-${variant}${active ? ' game-tab-selected' : ''}`
}

function NavRasterIcon({
  src,
  className = 'game-tab-icon',
}: IconProps & { src: string }) {
  return <img src={src} alt="" className={`${className} nav-raster-icon`} aria-hidden />
}

export function IconHubCurrent({ className = 'game-tab-icon' }: IconProps) {
  return <NavRasterIcon src={NAV_ICON_SRC.current} className={className} />
}

export function IconHubPast({ className = 'game-tab-icon' }: IconProps) {
  return <NavRasterIcon src={NAV_ICON_SRC.past} className={className} />
}

export function IconHubLeaderboard({ className = 'game-tab-icon' }: IconProps) {
  return <NavRasterIcon src={NAV_ICON_SRC.leaderboard} className={`${className} nav-raster-icon-yellow`} />
}

export function IconPlayGames({ className = 'game-tab-icon' }: IconProps) {
  return <NavRasterIcon src={NAV_ICON_SRC.playGames} className={className} />
}

export function IconProfile({ className = 'game-tab-icon' }: IconProps) {
  return <NavRasterIcon src={NAV_ICON_SRC.profile} className={className} />
}

export function IconFriendly({ className = 'game-tab-icon' }: IconProps) {
  return <NavRasterIcon src={NAV_ICON_SRC.friendly} className={className} />
}

export function IconCompetition({ className = 'game-tab-icon' }: IconProps) {
  return <NavRasterIcon src={NAV_ICON_SRC.competition} className={`${className} nav-raster-icon-yellow`} />
}
