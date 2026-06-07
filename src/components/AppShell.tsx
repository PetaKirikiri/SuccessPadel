import type { ReactNode } from 'react'
import { LineEntryGate } from './LineEntryGate'
import { LineOAuthReturnHandler } from './LineOAuthReturnHandler'
import { LoginWithAPPDebugOverlay } from './LoginWithAPPDebugOverlay'

type Props = {
  children: ReactNode
}

export function AppShell({ children }: Props) {
  return (
    <div className="viewport-lock">
      <LineEntryGate>
        <LineOAuthReturnHandler />
        {children}
        <LoginWithAPPDebugOverlay />
      </LineEntryGate>
    </div>
  )
}
