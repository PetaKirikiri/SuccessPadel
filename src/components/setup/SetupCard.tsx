import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { RuleChip } from '../../lib/friendlyGameDisplay'
import { RuleChipGrid } from '../RuleChipGrid'

type Props = {
  ruleChips?: RuleChip[]
  header?: ReactNode
  children?: ReactNode
  preview?: ReactNode
  footer?: ReactNode
} & Omit<ComponentPropsWithoutRef<'section'>, 'children'>

export function SetupCard({
  ruleChips = [],
  header,
  children,
  preview,
  footer,
  className = '',
  ...sectionProps
}: Props) {
  return (
    <section className={`settings-card game-card space-y-3 ${className}`.trim()} {...sectionProps}>
      {header}
      {ruleChips.length > 0 ? <RuleChipGrid chips={ruleChips} /> : null}
      {children}
      {preview}
      {footer}
    </section>
  )
}
