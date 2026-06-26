import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useIsTvLayout } from '../hooks/useIsTvLayout'
import { setTvKioskMode } from '../lib/suppressVercelToolbar'
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

const COMPETITION_PLAY_PATH = /^\/competitions\/[^/]+$/

export function AppShell({ children }: Props) {
  const { pathname, search } = useLocation()
  const isTvLayout = useIsTvLayout()
  const [gesturePadActive, setGesturePadActive] = useState(false)
  const isTvKiosk = COMPETITION_PLAY_PATH.test(pathname) && isTvLayout

  useEffect(() => {
    setTvKioskMode(isTvKiosk)
    return () => setTvKioskMode(false)
  }, [isTvKiosk])

  const hideGlobalChrome =
    gesturePadActive || isGesturePadRoute(pathname) || isTvKiosk

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
