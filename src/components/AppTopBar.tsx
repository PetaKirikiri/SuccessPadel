import type { ReactNode } from 'react'
import { AppShellColumn } from './AppShell'

type Props = {
  children: ReactNode
  className?: string
}

export function AppTopBar({ children, className = '' }: Props) {
  return (
    <header
      className={`relative flex min-h-[calc(max(0.75rem,env(safe-area-inset-top,0px))+3.25rem)] shrink-0 items-center pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:min-h-[calc(max(0.75rem,env(safe-area-inset-top,0px))+3.5rem)] ${className}`}
    >
      <AppShellColumn fill={false} className="flex min-w-0 items-center">
        {children}
      </AppShellColumn>
    </header>
  )
}
