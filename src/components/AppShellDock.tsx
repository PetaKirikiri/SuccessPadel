import type { ReactNode } from 'react'
import { AppShellColumn } from './AppShellColumn'

type Props = {
  children: ReactNode
  'aria-label': string
}

/** Tab bar pinned to the bottom of the shell (in-flow, not scrollable). */
export function AppShellDock({ children, 'aria-label': ariaLabel }: Props) {
  return (
    <nav className="app-shell-dock" aria-label={ariaLabel}>
      <AppShellColumn fill={false}>
        <div className="app-shell-dock-inner">{children}</div>
      </AppShellColumn>
    </nav>
  )
}
