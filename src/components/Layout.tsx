import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { AppBottomNav } from './AppBottomNav'
import { AppShellColumn, hasAppBottomNav, isPlaySessionPath } from './AppShell'
import { AppTopBar } from './AppTopBar'
import { LineBookmarkBanner } from './LineBookmarkBanner'

export function Layout() {
  const { t } = useTranslation()
  const loc = useLocation()
  const onPlayerProfile = loc.pathname.startsWith('/players/')
  const isGamesHub = loc.pathname === '/friendly' || loc.pathname === '/competitive'
  const isPlaySession = isPlaySessionPath(loc.pathname)
  const showBottomNav = hasAppBottomNav(loc.pathname)
  const needsFillViewport = isGamesHub || isPlaySession

  return (
    <div className="shell-paper game-bg flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {!onPlayerProfile && !isPlaySession && !showBottomNav ? (
        <AppTopBar>
          <img
            src="/brand/logo-padel.webp"
            alt={t('common.brandAlt')}
            className="h-8 w-auto max-w-[7rem] shrink-0 md:h-10 md:max-w-[9rem]"
          />
        </AppTopBar>
      ) : null}

      <main
        data-scroll-y={onPlayerProfile || needsFillViewport ? undefined : true}
        className={`shell-main min-h-0 min-w-0 flex-1 basis-0 ${
          onPlayerProfile
            ? 'shell-main--profile flex flex-col overflow-hidden p-0'
            : needsFillViewport
              ? 'flex flex-col overflow-hidden'
              : 'scroll-y flex flex-col'
        }`}
      >
        {onPlayerProfile ? (
          <Outlet />
        ) : showBottomNav ? (
          <AppShellColumn
            edgeToEdge
            fill={needsFillViewport}
            className={
              needsFillViewport ? 'min-h-0 flex-1 overflow-hidden' : 'w-full min-w-0'
            }
          >
            {!isGamesHub && !isPlaySession ? <LineBookmarkBanner /> : null}
            <Outlet />
          </AppShellColumn>
        ) : (
          <AppShellColumn className={isGamesHub ? 'overflow-hidden' : 'pb-2 pt-1'}>
            {!isGamesHub ? <LineBookmarkBanner /> : null}
            <Outlet />
          </AppShellColumn>
        )}
      </main>
      {showBottomNav ? (
        <div className="shell-dock">
          <AppBottomNav />
        </div>
      ) : null}
    </div>
  )
}
