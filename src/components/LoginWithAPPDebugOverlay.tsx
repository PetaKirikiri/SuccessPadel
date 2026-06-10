import { useCallback, useEffect, useState } from 'react'
import {
  clearLoginWithAppDebugLog,
  isLoginDebugMode,
  readLoginWithAppDebugLog,
  type LoginDebugEntry,
} from '../lib/debug/loginWithAppDebug'

function formatLine(e: LoginDebugEntry): string {
  const t = new Date(e.timestamp).toISOString().slice(11, 23)
  return `${t} #${e.seq} ${e.hypothesisId} ${e.location}: ${e.message}`
}

/** Sticky on-device debug panel — survives LIFF navigation when ?debug=1 was used once. */
export function LoginWithAPPDebugOverlay() {
  const [open, setOpen] = useState(true)
  const [lines, setLines] = useState<LoginDebugEntry[]>([])
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    setLines(readLoginWithAppDebugLog())
  }, [])

  useEffect(() => {
    if (!isLoginDebugMode()) return
    refresh()
    const onLog = () => refresh()
    const id = window.setInterval(refresh, 1000)
    window.addEventListener('login-debug-log', onLog)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('login-debug-log', onLog)
    }
  }, [refresh])

  if (!isLoginDebugMode()) return null

  const copy = async () => {
    const payload = JSON.stringify(lines, null, 2)
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-[9999] border-t border-amber-400 bg-black/90 text-amber-100"
      style={{ maxHeight: open ? '42vh' : '2.25rem' }}
    >
      <div className="flex items-center justify-between gap-2 px-2 py-1 text-[10px]">
        <button
          type="button"
          className="font-semibold text-amber-300"
          onClick={() => setOpen((v) => !v)}
        >
          DEBUG {lines.length} {open ? '▼' : '▲'}
        </button>
        <div className="flex gap-2">
          <button type="button" className="text-amber-200 underline" onClick={refresh}>
            refresh
          </button>
          <button type="button" className="text-amber-200 underline" onClick={copy}>
            {copied ? 'copied' : 'copy JSON'}
          </button>
          <button
            type="button"
            className="text-red-300 underline"
            onClick={() => {
              clearLoginWithAppDebugLog()
              refresh()
            }}
          >
            clear
          </button>
        </div>
      </div>
      {open && (
        <pre className="max-h-[36vh] overflow-auto px-2 pb-2 text-[9px] leading-tight">
          {lines.length === 0
            ? 'No logs yet — open via LINE / Sign In…'
            : lines.map((e) => (
                <div key={`${e.seq}-${e.timestamp}`} className="border-b border-amber-900/50 py-0.5">
                  <div>{formatLine(e)}</div>
                  <div className="text-amber-500/80">{JSON.stringify(e.data)}</div>
                </div>
              ))}
        </pre>
      )}
    </div>
  )
}
