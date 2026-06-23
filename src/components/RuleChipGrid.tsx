import { useState, type ReactNode } from 'react'
import type { RuleChip } from '../lib/friendlyGameDisplay'
import { RuleChipIcon } from './RuleChipIcon'
import { RuleHintModal } from './RuleHintModal'

type Props = {
  chips: RuleChip[]
  /** Inline chips in the schedule panel (right column). */
  inline?: boolean
  /** Extra grid cells after chips (e.g. admin badge buttons). */
  trailing?: ReactNode
}

function RuleChipButton({
  chip,
  inline,
  onSelect,
}: {
  chip: RuleChip
  inline: boolean
  onSelect: (chip: RuleChip) => void
}) {
  const open = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect(chip)
  }

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={open}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(chip)
        }
      }}
      className={
        inline
          ? 'flex min-h-[3rem] min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-lg border-2 border-brand-primary/30 bg-brand-bg-alt px-2 py-2 transition active:opacity-80 sm:min-h-[2.75rem] sm:gap-2 sm:px-2.5'
          : 'inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border-2 border-brand-primary/30 bg-brand-bg-alt py-2 pl-2.5 pr-2 transition active:opacity-80'
      }
    >
      <span
        className={
          inline
            ? 'min-w-0 flex-1 whitespace-normal break-normal text-[11px] font-bold leading-snug text-brand-primary [overflow-wrap:normal] sm:text-sm'
            : 'text-sm font-bold leading-snug text-brand-primary'
        }
      >
        {chip.label}
      </span>
      <RuleChipIcon
        icon={chip.icon}
        className={inline ? 'h-5 w-5 shrink-0 text-brand-accent sm:h-6 sm:w-6' : 'h-6 w-6 text-brand-accent'}
      />
    </li>
  )
}

export function RuleChipGrid({ chips, inline = false, trailing }: Props) {
  const [active, setActive] = useState<RuleChip | null>(null)

  if (chips.length === 0 && !trailing) return null

  return (
    <>
      <ul
        className={
          inline
            ? 'm-0 grid w-full min-w-0 list-none grid-cols-2 gap-1.5 p-0 sm:gap-2'
            : 'm-0 grid list-none grid-cols-3 gap-1.5 p-0'
        }
      >
        {chips.map((chip) => (
          <RuleChipButton key={chip.key} chip={chip} inline={inline} onSelect={setActive} />
        ))}
        {trailing}
      </ul>
      {active ? <RuleHintModal chip={active} onClose={() => setActive(null)} /> : null}
    </>
  )
}
