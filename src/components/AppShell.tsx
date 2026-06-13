import type { ReactNode } from 'react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { GlobalProfileChip } from './GlobalProfileChip'
import { LineEntryGate } from './LineEntryGate'
import { LineOAuthReturnHandler } from './LineOAuthReturnHandler'
import {
  isPlayerLinkHandoffSearch,
  LinePlayerLinkEntryHandler,
} from './LinePlayerLinkEntryHandler'
import { LoginWithAPPDebugOverlay } from './LoginWithAPPDebugOverlay'
import { GesturePadChromeContext, isGesturePadRoute } from '../lib/gesturePadChrome'

type Props = {
  children: ReactNode
}

export function AppShell({ children }: Props) {
  const { pathname, search } = useLocation()
  const [gesturePadActive, setGesturePadActive] = useState(false)
  const hideGlobalChrome = gesturePadActive || isGesturePadRoute(pathname)

  if (isPlayerLinkHandoffSearch(search)) {
    return (
      <>
        {!hideGlobalChrome ? <GlobalProfileChip /> : null}
        <LinePlayerLinkEntryHandler />
      </>
    )
  }

  return (
    <GesturePadChromeContext.Provider value={setGesturePadActive}>
      <div className="viewport-lock flex flex-col">
        {!hideGlobalChrome ? <GlobalProfileChip /> : null}
        <LineEntryGate>
          <LineOAuthReturnHandler />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          <LoginWithAPPDebugOverlay />
        </LineEntryGate>
      </div>
    </GesturePadChromeContext.Provider>
  )
}
