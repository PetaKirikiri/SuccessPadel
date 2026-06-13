import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { isGesturePadRoute } from '../lib/gesturePadChrome'
import { AppBottomNav } from './AppBottomNav'
import { AppShellColumn } from './AppShellColumn'
import { AppShellPanel } from './AppShellPanel'
import { AppTopBar } from './AppTopBar'
import { LineBookmarkBanner } from './LineBookmarkBanner'

export function Layout() {
  const { t } = useTranslation()
  const loc = useLocation()
  const onPlayerProfile = loc.pathname.startsWith('/players/')
  const isGamesHub = loc.pathname === '/friendly' || loc.pathname === '/competitive'
  const isFriendlySession = /^\/friendly\/[^/]+$/.test(loc.pathname)
  const isCompetitionRun = /^\/competitions\/[^/]+\/run$/.test(loc.pathname)
  const showBottomNav =
    !onPlayerProfile && !isGesturePadRoute(loc.pathname) && !isCompetitionRun && !isFriendlySession
  const useSessionShell = isGamesHub || showBottomNav || isFriendlySession

  return (
    <div className="game-bg flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {!onPlayerProfile && !isFriendlySession ? (
        <AppTopBar>
          <img
            src="/brand/logo-padel.webp"
            alt={t('common.brandAlt')}
            className="h-8 w-auto max-w-[7rem] shrink-0 md:h-10 md:max-w-[9rem]"
          />
        </AppTopBar>
      ) : null}

      <main
        data-scroll-y={onPlayerProfile || useSessionShell ? undefined : true}
        className={`min-h-0 min-w-0 flex-1 basis-0 ${
          onPlayerProfile
            ? 'flex flex-col overflow-hidden p-0'
            : useSessionShell
              ? 'flex flex-col overflow-hidden'
              : 'scroll-y'
        }`}
      >
        {onPlayerProfile ? (
          <Outlet />
        ) : (
          <AppShellColumn
            className={
              showBottomNav
                ? 'overflow-hidden pt-1'
                : isGamesHub || isFriendlySession
                  ? 'overflow-hidden pb-2 pt-0'
                  : 'pb-2 pt-1'
            }
          >
            {showBottomNav ? (
              <AppShellPanel scrollBody={!isGamesHub} footer={<AppBottomNav embedded />}>
                {!isGamesHub ? <LineBookmarkBanner /> : null}
                <Outlet />
              </AppShellPanel>
            ) : (
              <>
                {!isGamesHub && !isFriendlySession ? <LineBookmarkBanner /> : null}
                <Outlet />
              </>
            )}
          </AppShellColumn>
        )}
      </main>
    </div>
  )
}
