import {
  Clock,
  Coffee,
  Crown,
  Gauge,
  LayoutGrid,
  Link2,
  Pause,
  Shuffle,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { RuleIcon } from '../lib/friendlyGameDisplay'

type Props = {
  icon: RuleIcon
  className?: string
}

const ICONS: Record<RuleIcon, LucideIcon> = {
  americano: Coffee,
  king: Crown,
  time: Clock,
  'partners-fixed': Link2,
  'partners-swapped': Shuffle,
  scoring: Target,
  rounds: LayoutGrid,
  'game-minutes': Clock,
  break: Pause,
  level: Gauge,
  gender: Users,
}

export function RuleChipIcon({ icon, className = 'h-6 w-6' }: Props) {
  const Icon = ICONS[icon]
  return <Icon className={`${className} shrink-0`} aria-hidden strokeWidth={2} />
}
