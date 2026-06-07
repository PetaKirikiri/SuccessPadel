import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { GlobalProfileChip } from './GlobalProfileChip'
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
    return (
      <>
        <GlobalProfileChip />
        <LinePlayerLinkEntryHandler />
      </>
    )
  }

  return (
    <div className="viewport-lock">
      <GlobalProfileChip />
      <LineEntryGate>
        <LineOAuthReturnHandler />
        {children}
        <LoginWithAPPDebugOverlay />
      </LineEntryGate>
    </div>
  )
}
