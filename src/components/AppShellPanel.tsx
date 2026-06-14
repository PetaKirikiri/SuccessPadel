import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  footer: ReactNode
  /** Hub views manage their own scroll region. */
  scrollBody?: boolean
  className?: string
}

/** One bordered panel: scrollable body + footer tabs pinned at the bottom. */
export function AppShellPanel({ children, footer, scrollBody = true, className = '' }: Props) {
  return (
    <div className={`app-shell-panel${className ? ` ${className}` : ''}`}>
      {scrollBody ? (
        <div data-scroll-y className="app-shell-panel-body app-shell-panel-inset">
          {children}
        </div>
      ) : (
        <div className="app-shell-panel-slot">{children}</div>
      )}
      {footer}
    </div>
  )
}
