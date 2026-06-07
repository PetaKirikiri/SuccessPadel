import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function AppTopBar({ children, className = '' }: Props) {
  return (
    <header
      className={`relative flex shrink-0 items-center px-3 pb-2 pr-52 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6 md:pr-[18rem] ${className}`}
    >
      {children}
    </header>
  )
}
