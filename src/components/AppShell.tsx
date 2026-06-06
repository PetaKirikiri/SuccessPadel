import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export function AppShell({ children }: Props) {
  return <div className="viewport-lock">{children}</div>
}
