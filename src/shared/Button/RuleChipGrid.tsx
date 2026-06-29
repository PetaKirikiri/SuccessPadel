import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { RuleChip } from '../../lib/friendlyGameDisplay'
import { RuleChipIcon } from '../../shared/Button/RuleChipIcon'
import { RuleHintModal } from '../../shared/Modal/RuleHintModal'

type Props = {
  chips: RuleChip[]
  /** Inline chips in the schedule panel (right column). */
  inline?: boolean
  /** Compact badges for invite card headers. */
  compact?: boolean
  /** Extra grid cells after chips (e.g. admin badge buttons). */
  trailing?: ReactNode
}

function chipColumns(compact: boolean, inline: boolean): number {
  if (compact || inline) return 2
  return 3
}

function gridClass(compact: boolean, inline: boolean): string {
  const cols = chipColumns(compact, inline)
  const variant = compact ? 'rule-chip-grid--compact' : inline ? 'rule-chip-grid--inline' : 'rule-chip-grid--default'
  return `rule-chip-grid rule-chip-grid--cols-${cols} ${variant}`
}

function useEqualChipWidth(chipCount: number, columns: number, enabled: boolean) {
  const gridRef = useRef<HTMLUListElement>(null)

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    if (!enabled) {
      grid.style.removeProperty('--rule-chip-width')
      return
    }

    const measure = () => {
      const items = Array.from(
        grid.querySelectorAll<HTMLElement>(':scope > .rule-chip-grid__item'),
      )
      if (items.length === 0) return

      grid.style.removeProperty('--rule-chip-width')
      items.forEach((item) => {
        item.style.width = ''
      })

      const max = Math.max(...items.map((item) => item.getBoundingClientRect().width), 0)
      if (max > 0) {
        grid.style.setProperty('--rule-chip-width', `${Math.ceil(max)}px`)
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [chipCount, columns, enabled])

  return gridRef
}

function RuleChipButton({
  chip,
  compact,
  onSelect,
}: {
  chip: RuleChip
  compact: boolean
  onSelect: (chip: RuleChip) => void
}) {
  const open = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect(chip)
  }

  // Compact (invite card): icon + value only. value '' = icon only; undefined = fall back to label.
  const text = compact && chip.value !== undefined ? chip.value : chip.label
  const textClass = compact && chip.value !== undefined ? 'rule-chip-grid__value' : 'rule-chip-grid__label'

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
      className="rule-chip-grid__item"
    >
      {text ? <span className={textClass}>{text}</span> : null}
      <RuleChipIcon icon={chip.icon} className="rule-chip-grid__icon" />
    </li>
  )
}

export function RuleChipGrid({ chips, inline = false, compact = false, trailing }: Props) {
  const [active, setActive] = useState<RuleChip | null>(null)
  const columns = chipColumns(compact, inline)
  const gridRef = useEqualChipWidth(chips.length + (trailing ? 1 : 0), columns, !compact)

  if (chips.length === 0 && !trailing) return null

  return (
    <>
      <ul ref={gridRef} className={gridClass(compact, inline)}>
        {chips.map((chip) => (
          <RuleChipButton key={chip.key} chip={chip} compact={compact} onSelect={setActive} />
        ))}
        {trailing}
      </ul>
      {active ? <RuleHintModal chip={active} onClose={() => setActive(null)} /> : null}
    </>
  )
}
