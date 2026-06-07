import type { ReactNode } from 'react'
import { LineEntryGate } from './LineEntryGate'
import { LineOAuthReturnHandler } from './LineOAuthReturnHandler'
import { LinePlayerLinkEntryHandler } from './LinePlayerLinkEntryHandler'
import { LoginWithAPPDebugOverlay } from './LoginWithAPPDebugOverlay'

type Props = {
  children: ReactNode
}

export function AppShell({ children }: Props) {
  return (
    <div className="viewport-lock">
      <LineEntryGate>
        <LinePlayerLinkEntryHandler />
        <LineOAuthReturnHandler />
        {children}
        <LoginWithAPPDebugOverlay />
      </LineEntryGate>
    </div>
  )
}
