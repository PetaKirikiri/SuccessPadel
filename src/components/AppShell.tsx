import type { ComponentProps, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useIsTvLayout } from '../hooks/useIsTvLayout'
import { setTvKioskMode } from '../lib/suppressVercelToolbar'
import { LineEntryGate } from './LineEntryGate'
import { ViewportProvider } from '../contexts/ViewportContext'
import { LineOAuthReturnHandler } from './LineOAuthReturnHandler'
import {
  isPlayerLinkHandoffSearch,
  LinePlayerLinkEntryHandler,
} from './LinePlayerLinkEntryHandler'
import { LoginWithAPPDebugOverlay } from './LoginWithAPPDebugOverlay'
import { GesturePadChromeContext, isGesturePadRoute } from '../lib/gesturePadChrome'

/** Gutter on the viewport edge — kept narrow so content can use more width. */
const APP_SHELL_GUTTER = 'px-3 md:px-4 lg:px-5'

/** Inner column max width — wider than the old 3xl/4xl stack. */
const APP_SHELL_INNER = 'mx-auto w-full min-w-0 max-w-full md:max-w-6xl lg:max-w-7xl'

export const APP_SHELL_CLASS = `${APP_SHELL_GUTTER} ${APP_SHELL_INNER}`

type ShellProps = {
  children: ReactNode
}

const COMPETITION_PLAY_PATH = /^\/competitions\/[^/]+$/
const FRIENDLY_PLAY_PATH = /^\/friendly\/(?!new(?:\/|$))[^/]+$/
const COMPETITION_RUN_PATH = /^\/competitions\/[^/]+\/run$/

/** Profile/sign-in lives in AppBottomNav only — never a fixed top-right chip. */
export function hasAppBottomNav(pathname: string): boolean {
  if (isGesturePadRoute(pathname)) return false
  if (COMPETITION_RUN_PATH.test(pathname)) return false
  return true
}

export function isPlaySessionPath(pathname: string): boolean {
  return FRIENDLY_PLAY_PATH.test(pathname) || (COMPETITION_PLAY_PATH.test(pathname) && !COMPETITION_RUN_PATH.test(pathname))
}

/** Root viewport chrome — one shell for the whole app. */
export function AppShell({ children }: ShellProps) {
  const { pathname, search } = useLocation()
  const isTvLayout = useIsTvLayout()
  const [, setGesturePadActive] = useState(false)
  const isTvKiosk =
    isTvLayout && (COMPETITION_PLAY_PATH.test(pathname) || FRIENDLY_PLAY_PATH.test(pathname))

  useEffect(() => {
    setTvKioskMode(isTvKiosk)
    return () => setTvKioskMode(false)
  }, [isTvKiosk])

  if (isPlayerLinkHandoffSearch(search)) {
    return <LinePlayerLinkEntryHandler />
  }

  return (
    <ViewportProvider>
      <GesturePadChromeContext.Provider value={setGesturePadActive}>
        <div className="viewport-lock flex flex-col">
          <LineEntryGate>
            <LineOAuthReturnHandler />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
            <LoginWithAPPDebugOverlay />
          </LineEntryGate>
        </div>
      </GesturePadChromeContext.Provider>
    </ViewportProvider>
  )
}

type ColumnProps = ComponentProps<'div'> & {
  children: ReactNode
  /** When false, column does not grow (e.g. bottom dock bar). */
  fill?: boolean
  /** Large screens: flush to viewport edges, no max-width cap (TV play views). */
  edgeToEdge?: boolean
}

export function AppShellColumn({
  children,
  className = '',
  fill = true,
  edgeToEdge = false,
  ...props
}: ColumnProps) {
  if (edgeToEdge && fill) {
    return (
      <div
        className={`flex min-h-0 min-w-0 w-full flex-1 basis-0 flex-col${className ? ` ${className}` : ''}`}
        {...props}
      >
        {children}
      </div>
    )
  }

  const gutter = edgeToEdge ? '' : APP_SHELL_GUTTER
  const inner = edgeToEdge ? 'w-full min-w-0 max-w-full' : APP_SHELL_INNER
  const outerClass = fill
    ? `${gutter} flex min-h-0 min-w-0 w-full flex-1 basis-0 flex-col`
    : `${gutter} w-full shrink-0`
  const innerClass = fill
    ? `${inner} flex min-h-0 min-w-0 w-full flex-1 basis-0 flex-col`
    : inner

  return (
    <div className={outerClass}>
      <div className={`${innerClass}${className ? ` ${className}` : ''}`} {...props}>
        {children}
      </div>
    </div>
  )
}

type PanelProps = {
  children: ReactNode
  footer?: ReactNode
  /** Hub views manage their own scroll region. */
  scrollBody?: boolean
  className?: string
}

/** Bordered panel with scroll body and optional pinned footer (tabs). */
export function AppShellPanel({ children, footer, scrollBody = true, className = '' }: PanelProps) {
  return (
    <div className={`app-shell-panel${className ? ` ${className}` : ''}`}>
      {scrollBody ? (
        <div data-scroll-y className="app-shell-panel-body app-shell-panel-inset">
          {children}
        </div>
      ) : (
        <div className="app-shell-panel-slot">{children}</div>
      )}
      {footer ?? null}
    </div>
  )
}
