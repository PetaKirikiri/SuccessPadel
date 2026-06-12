import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { isGesturePadRoute } from '../lib/gesturePadChrome'
import { AppBottomNav } from './AppBottomNav'
import { AppTopBar } from './AppTopBar'
import { LineBookmarkBanner } from './LineBookmarkBanner'

export function Layout() {
  const { t } = useTranslation()
  const loc = useLocation()
  const onPlayerProfile = loc.pathname.startsWith('/players/')
  const isGamesHub = loc.pathname === '/friendly' || loc.pathname === '/competitive'
  const isCompetitionRun = /^\/competitions\/[^/]+\/run$/.test(loc.pathname)
  const showBottomNav = !onPlayerProfile && !isGesturePadRoute(loc.pathname) && !isCompetitionRun

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      {!onPlayerProfile ? (
        <AppTopBar className="py-3">
          <img
            src="/brand/logo-padel.webp"
            alt={t('common.brandAlt')}
            className="h-8 w-auto max-w-[7rem] shrink-0 md:h-10 md:max-w-[9rem]"
          />
        </AppTopBar>
      ) : null}

      <main
        data-scroll-y={onPlayerProfile || isGamesHub ? undefined : true}
        className={`min-h-0 min-w-0 flex-1 ${
          onPlayerProfile
            ? 'overflow-hidden p-0'
            : isGamesHub
              ? 'flex flex-col overflow-hidden px-3 pb-2 pt-0 md:px-6'
              : 'scroll-y px-3 pb-2 pt-1 md:px-6'
        }`}
      >
        {onPlayerProfile ? (
          <Outlet />
        ) : (
          <div
            className={`mx-auto w-full min-w-0 max-w-full md:max-w-3xl lg:max-w-4xl ${
              isGamesHub ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : ''
            }`}
          >
            {!isGamesHub ? <LineBookmarkBanner /> : null}
            <Outlet />
          </div>
        )}
      </main>

      {showBottomNav ? <AppBottomNav /> : null}
    </div>
  )
}
