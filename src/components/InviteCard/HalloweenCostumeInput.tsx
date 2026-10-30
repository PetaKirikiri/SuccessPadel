import { useEffect, useRef, useState } from 'react'
import { saveHalloweenCostume, type HalloweenCostume } from '../../lib/halloweenCostumes'

type Props = { sessionId: string; costume: HalloweenCostume; token: string | null; disabled?: boolean }
export function HalloweenCostumeInput({ sessionId, costume, token, disabled }: Props) {
  const [value, setValue] = useState(costume.description)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const saved = useRef(costume)
  const current = useRef(value)
  const pending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function flush() {
    if (pending.current || disabled || current.current.trim() === saved.current.description) return
    pending.current = true
    setStatus('saving'); setError('')
    const next = current.current.trim()
    try {
      saved.current = await saveHalloweenCostume(sessionId, saved.current, next, token)
      if (mounted.current) setStatus('saved')
    } catch (e) {
      if (mounted.current) { setError(e instanceof Error ? e.message : (e as { message?: string }).message ?? 'Could not save costume'); setStatus('error') }
      pending.current = false
      return
    }
    pending.current = false
    // A newer edit made while saving is sent after the previous revision completes.
    if (mounted.current && current.current.trim() !== saved.current.description) void flush()
  }
  useEffect(() => {
    if (status === 'error') return
    const timer = setTimeout(() => void flush(), 700)
    return () => clearTimeout(timer)
  }, [value])
  return <div className="halloween-costume-field" data-save-state={status}>
    <input aria-label={`Halloween costume for ${costume.display_name}`} placeholder="Halloween costume…"
      title="Halloween costume" maxLength={2000} value={value} disabled={disabled}
      onChange={event => { current.current = event.target.value; setValue(event.target.value); setStatus('idle') }}
      onBlur={() => void flush()} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void flush() } }} />
    <span className="halloween-costume-field__status" role="status" aria-live="polite">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}</span>
    {error && <span className="halloween-costume-field__error" role="alert">{error} <button type="button" onClick={() => void flush()}>Retry</button></span>}
  </div>
}
