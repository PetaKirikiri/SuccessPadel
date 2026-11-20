import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type InputEvent = { code: string; key: string; edge: string; repeat: boolean; ms: number }
type Capture = { id: string; start: number; events: InputEvent[] }
const testDuration = 30_000

// A clicker commonly sends a media key or an activation key. Omit printable
// key values so the test does not store text typed on an attached keyboard.
const safeKey = (value: string) => value.length > 1 && /^[a-zA-Z0-9]+$/.test(value) ? value.slice(0, 32) : ''

export function ScorerInputTest({ active, setActive }: { active: boolean; setActive: (active: boolean) => void }) {
  const [status, setStatus] = useState('')
  const [events, setEvents] = useState<InputEvent[]>([])
  const dialog = useRef<HTMLDialogElement>(null)
  const capture = useRef<Capture | null>(null)

  useEffect(() => {
    const run = capture.current
    if (!active || !run) return
    const record = (event: KeyboardEvent) => {
      if (!event.isTrusted || event.metaKey || event.altKey || event.ctrlKey || run.events.length >= 60) return
      const code = safeKey(event.code)
      if (/^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(code)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      run.events.push({ code, key: safeKey(event.key), edge: event.type, repeat: event.repeat, ms: Math.round(performance.now() - run.start) })
      setEvents([...run.events])
      setStatus(run.events.length + ' events captured')
    }
    window.addEventListener('keydown', record, true)
    window.addEventListener('keyup', record, true)
    const timer = window.setTimeout(() => setActive(false), testDuration)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', record, true)
      window.removeEventListener('keyup', record, true)
    }
  }, [active, setActive])

  useEffect(() => {
    const run = capture.current
    if (active || !run) return
    capture.current = null
    setStatus('Saving…')
    void (async () => {
      const { error } = await supabase.from('scorer_input_diagnostics').insert({
        session_id: run.id,
        browser: navigator.userAgent.slice(0, 200),
        events: run.events,
      })
      setStatus(error ? 'Could not save. Start a new test to retry.' : 'Saved ' + run.events.length + ' events')
    })()
  }, [active])

  function start() {
    capture.current = { id: crypto.randomUUID(), start: performance.now(), events: [] }
    setEvents([])
    setStatus('Listening. Press either clicker button.')
    setActive(true)
    dialog.current?.showModal()
  }

  return <div className="scorer-input-test">
    <button type="button" disabled={active || status === 'Saving…'} onClick={start}>Test clicker</button>
    <dialog ref={dialog} className="court-score-controls" aria-label="Clicker input test"
      onCancel={event => { event.preventDefault(); if (active) setActive(false); else dialog.current?.close() }}>
      <h2>Clicker input test</h2>
      <p role="status">{status}</p>
      <pre className="scorer-input-test__log">{events.length
        ? events.slice(-10).map(event => `${event.ms} ms · ${event.code || event.key || 'Unidentified'} · ${event.edge}`).join('\n')
        : 'No button events received yet.'}</pre>
      {active
        ? <button type="button" onClick={() => setActive(false)}>Stop & save</button>
        : <button type="button" onClick={() => dialog.current?.close()}>Close</button>}
    </dialog>
  </div>
}
