import {
  CalendarDays,
  Clock3,
  LayoutGrid,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react'

type IconProps = { className?: string }

export function shellTabClass(active: boolean, variant: 'rank' | 'competition' = 'competition') {
  return `game-tab min-w-0 flex-1 basis-0 gap-1 game-tab-${variant}${active ? ' game-tab-selected' : ''}`
}

export function IconHubCurrent({ className = 'game-tab-icon' }: IconProps) {
  return <CalendarDays className={className} strokeWidth={2.25} aria-hidden />
}

export function IconHubPast({ className = 'game-tab-icon' }: IconProps) {
  return <Clock3 className={className} strokeWidth={2.25} aria-hidden />
}

export function IconHubLeaderboard({ className = 'game-tab-icon' }: IconProps) {
  return <Trophy className={className} strokeWidth={2.25} aria-hidden />
}

export function IconPlayGames({ className = 'game-tab-icon' }: IconProps) {
  return <LayoutGrid className={className} strokeWidth={2.25} aria-hidden />
}

export function IconProfile({ className = 'game-tab-icon' }: IconProps) {
  return <UserRound className={className} strokeWidth={2.25} aria-hidden />
}

export function IconFriendly({ className = 'game-tab-icon' }: IconProps) {
  return <UsersRound className={className} strokeWidth={2.25} aria-hidden />
}

export function IconCompetition({ className = 'game-tab-icon' }: IconProps) {
  return <Trophy className={className} strokeWidth={2.25} aria-hidden />
}
