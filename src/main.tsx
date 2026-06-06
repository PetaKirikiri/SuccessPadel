import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppShell } from './components/AppShell'
import { SetupNotice } from './components/SetupNotice'
import { AuthProvider } from './providers/AuthProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppShell>
        <div className="app-shell">
          <SetupNotice />
          <App />
        </div>
      </AppShell>
    </AuthProvider>
  </StrictMode>,
)
