import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function AppTopBar({ children, className = '' }: Props) {
  return (
    <header
      className={`relative flex min-h-[calc(max(0.75rem,env(safe-area-inset-top,0px))+3.25rem)] shrink-0 items-center px-3 pb-3 pr-52 pt-[max(0.75rem,env(safe-area-inset-top))] md:min-h-[calc(max(0.75rem,env(safe-area-inset-top,0px))+3.5rem)] md:px-6 ${className}`}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-full items-center md:max-w-3xl lg:max-w-4xl">
        {children}
      </div>
    </header>
  )
}
