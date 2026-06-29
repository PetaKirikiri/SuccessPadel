import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './foundation/AppShell'
import { NativeDeepLinkHandler } from './foundation/NativeDeepLinkHandler'
import { AppRoutes } from './foundation/routes'
import { useLockViewport } from './hooks/useLockViewport'
import { AuthProvider } from './providers/AuthProvider'
import { LocaleProvider } from './providers/LocaleProvider'
import { ThemeProvider } from './providers/ThemeProvider'

export default function App() {
  useLockViewport()

  return (
    <BrowserRouter>
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
