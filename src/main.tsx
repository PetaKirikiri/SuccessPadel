import { StrictMode } from 'react'
import cssHasPseudo from 'css-has-pseudo/browser'
import { createRoot } from 'react-dom/client'
import './index.css'
import { suppressVercelToolbar } from './lib/suppressVercelToolbar'
import { englishEntry, ENGLISH_HOTEL } from './lib/line/englishEntry'

// Native browsers retain their CSS path; older TV engines track relational selectors.
cssHasPseudo(document, { observedAttributes: ['data-viewport', 'data-kind', 'data-competition-format', 'data-fixed-pairs', 'data-dragging', 'hidden'] })
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
