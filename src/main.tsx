import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { suppressVercelToolbar } from './lib/suppressVercelToolbar'
import { englishEntry, ENGLISH_HOTEL } from './lib/line/englishEntry'

suppressVercelToolbar()

const root = document.getElementById('root')!
if (englishEntry(window.location.search)) {
  // Keep Padel's providers, session recovery and navigation out of this callback.
  root.textContent = 'English Success · Connecting…'
  void import('./englishSuccessEntry').then(({ startEnglishEntry }) => startEnglishEntry(root)).catch(() => {
    const back = document.createElement('a')
    back.href = ENGLISH_HOTEL
    back.textContent = 'Return to English Success and try again'
    root.replaceChildren(back)
  })
} else {
  void import('./App.tsx').then(({ default: App }) => {
    createRoot(root).render(<StrictMode><App /></StrictMode>)
  })
}
