import type { ReactNode } from 'react'
import {
  Activity,
  CircleDot,
  Columns2,
  Crosshair,
  Flame,
  LayoutGrid,
  Mars,
  Minus,
  Network,
  Shield,
  Trophy,
  TrendingUp,
  Venus,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { SkillLevel } from '../lib/competitionPresets'
import type { PlayStyle, PlayerGender } from '../lib/profileFields'
import type { DominantHand, PlaySide } from '../lib/types'

export const GENDER_ICONS: Record<PlayerGender, LucideIcon> = { Male: Mars, Female: Venus }
export const GENDER_CHIP_COLORS: Record<PlayerGender, string> = {
  Male: 'text-blue-600',
  Female: 'text-fuchsia-600',
}
export const HAND_CHIP_COLORS: Record<DominantHand, string> = {
  left: 'text-sky-600',
  right: 'text-indigo-600',
}
export const LEVEL_ICONS: Record<SkillLevel, LucideIcon> = {
  Beginner: CircleDot,
  'Low Inter': TrendingUp,
  Intermediate: Activity,
  Advanced: Flame,
  Open: Trophy,
}
export const LEVEL_CHIP_COLORS: Record<SkillLevel, string> = {
  Beginner: 'text-stone-500',
  'Low Inter': 'text-emerald-600',
  Intermediate: 'text-blue-600',
  Advanced: 'text-orange-600',
  Open: 'text-amber-600',
}
export const STYLE_ICONS: Record<PlayStyle, LucideIcon> = {
  Aggressive: Flame,
  Defensive: Shield,
  'All-court': LayoutGrid,
  'Net player': Network,
  Baseline: Minus,
  Power: Zap,
  Control: Crosshair,
}
export const STYLE_CHIP_COLORS: Record<PlayStyle, string> = {
  Aggressive: 'text-red-600',
  Defensive: 'text-blue-600',
  'All-court': 'text-violet-600',
  'Net player': 'text-cyan-600',
  Baseline: 'text-stone-600',
  Power: 'text-orange-600',
  Control: 'text-teal-600',
}
export const SIDE_ICONS: Record<PlaySide, LucideIcon> = {
  left: Zap,
  right: Crosshair,
  both: Columns2,
}
export const SIDE_CHIP_COLORS: Record<PlaySide, string> = {
  left: 'text-orange-600',
  right: 'text-teal-600',
  both: 'text-violet-600',
}

export function ProfileFormSection({
  icon: Icon,
  title,
  children,
  iconClassName,
  className,
  titleExtra,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
  iconClassName: string
  className?: string
  titleExtra?: ReactNode
}) {
  return (
    <section
      className={`rounded-xl border border-brand-border bg-[#f8f7f5] p-3 shadow-sm ${className ?? ''}`}
    >
      <h3 className="mb-2.5 flex items-center gap-1.5 border-b border-brand-border/70 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-primary">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${iconClassName}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">{title}</span>
        {titleExtra}
      </h3>
      {children}
    </section>
  )
}

export function ProfileFieldLabel({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: LucideIcon
  iconClassName?: string
  children: ReactNode
}) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
      <Icon
        className={`h-3 w-3 shrink-0 ${iconClassName ?? 'text-brand-muted'}`}
        aria-hidden
        strokeWidth={2.25}
      />
      {children}
    </span>
  )
}

export function ProfileIconChip({
  active,
  onClick,
  icon: Icon,
  label,
  iconClassName,
  compact,
  multilineLabel,
}: {
  active: boolean
  onClick?: () => void
  icon: LucideIcon
  label: string
  iconClassName?: string
  compact?: boolean
  multilineLabel?: boolean
}) {
  const className = `flex flex-col items-center justify-center gap-0.5 rounded-lg border ${
    compact ? 'min-h-[3.25rem] px-1 py-1.5' : 'min-w-[4.25rem] px-2 py-2'
  } ${
    active
      ? 'border-brand-accent bg-brand-surface text-brand-primary ring-1 ring-brand-accent/35'
      : 'border-brand-border/80 bg-brand-surface text-brand-text'
  }`

  const content = (
    <>
      <Icon
        className={`shrink-0 ${compact ? 'h-4 w-4' : 'h-5 w-5'} ${iconClassName ?? (active ? 'text-brand-accent' : 'text-brand-muted')}`}
        aria-hidden
        strokeWidth={2}
      />
      <span
        className={`max-w-full text-center font-semibold leading-tight ${
          multilineLabel ? 'whitespace-normal text-[8px]' : 'truncate text-[9px]'
        }`}
      >
        {label}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} transition active:scale-[0.98]`}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

export function ProfileReadonlyValue({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-brand-border/80 bg-brand-surface px-3 py-2 text-sm text-brand-text">
      {children}
    </p>
  )
}

export function ProfileEmptyValue({ children }: { children: ReactNode }) {
  return <p className="text-sm text-brand-muted">{children}</p>
}
