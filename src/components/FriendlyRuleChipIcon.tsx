import {
  Clock,
  Coffee,
  Crown,
  LayoutGrid,
  Link2,
  Pause,
  Shuffle,
  Target,
  type LucideIcon,
} from 'lucide-react'
import type { FriendlyRuleIcon } from '../lib/friendlyGameDisplay'

type Props = {
  icon: FriendlyRuleIcon
  className?: string
}

const ICONS: Record<FriendlyRuleIcon, LucideIcon> = {
  americano: Coffee,
  king: Crown,
  'partners-fixed': Link2,
  'partners-swapped': Shuffle,
  scoring: Target,
  rounds: LayoutGrid,
  'game-minutes': Clock,
  break: Pause,
}

export function FriendlyRuleChipIcon({ icon, className = 'h-6 w-6' }: Props) {
  const Icon = ICONS[icon]
  return <Icon className={`${className} shrink-0`} aria-hidden strokeWidth={2} />
}
