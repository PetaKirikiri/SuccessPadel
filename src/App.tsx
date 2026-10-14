import { useLayoutEffect } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { AppShell } from './foundation/AppShell'
import { NativeDeepLinkHandler } from './foundation/NativeDeepLinkHandler'
import { AppRoutes } from './foundation/routes'
import { useLockViewport } from './hooks/useLockViewport'
import { AuthProvider } from './providers/AuthProvider'
import { LocaleProvider } from './providers/LocaleProvider'
import { ThemeProvider } from './providers/ThemeProvider'

// Reuse the pre-paint HTML theme authority when React navigates without a reload.
function RoutePageTheme() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.dispatchEvent(new Event('sp:route-theme'))
  }, [pathname])
  return null
}

export default function App() {
  useLockViewport()

  return (
    <BrowserRouter>
      <RoutePageTheme />
      <ThemeProvider>
        <LocaleProvider>
          <AuthProvider>
            <AppShell>
              <NativeDeepLinkHandler />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <AppRoutes />
              </div>
            </AppShell>
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
