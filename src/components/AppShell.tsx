import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { LineEntryGate } from './LineEntryGate'
import { LineOAuthReturnHandler } from './LineOAuthReturnHandler'
import {
  isPlayerLinkHandoffSearch,
  LinePlayerLinkEntryHandler,
} from './LinePlayerLinkEntryHandler'
import { LoginWithAPPDebugOverlay } from './LoginWithAPPDebugOverlay'

type Props = {
  children: ReactNode
}

export function AppShell({ children }: Props) {
  const { search } = useLocation()

  if (isPlayerLinkHandoffSearch(search)) {
    return <LinePlayerLinkEntryHandler />
  }

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
