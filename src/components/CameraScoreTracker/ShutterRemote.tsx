import { useEffect, useRef, useState } from 'react'

type Mapping = { big: string; small: string }
type Button = keyof Mapping
const confirmedMacMapping: Mapping = { big: 'HID-0C-EA', small: '' }
const storageKey = 'court-shutter-buttons-v1'

function savedMapping(): Mapping | null {
  try {
    const m = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    return typeof m?.big === 'string' && typeof m.small === 'string' && m.big !== m.small ? m : null
  } catch { return null }
}

export function ShutterRemote({ onAction, clicker, scope }: { clicker?: boolean; scope: string; onAction: (ours: boolean, subtract: boolean) => void }) {
  const [learnedMapping, setMapping] = useState(savedMapping)
  const bridgeKey = 'mac-clicker-enabled:' + scope
  const [enabled, setEnabled] = useState(() => {
    try { return Boolean(import.meta.env.DEV && clicker && sessionStorage.getItem(bridgeKey) === '1') }
    catch { return false }
  })
  const [step, setStep] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [macBridge, setMacBridge] = useState(enabled)
  const mapping = macBridge
    ? learnedMapping?.big.startsWith('HID-') ? learnedMapping : confirmedMacMapping
    : learnedMapping?.big.startsWith('HID-') ? null : learnedMapping
  useEffect(() => {
    if (!import.meta.env.DEV || !clicker) return
    try { sessionStorage.setItem(bridgeKey, macBridge && enabled ? '1' : '0') }
    catch { /* Scoring still works for the current page. */ }
  }, [bridgeKey, clicker, enabled, macBridge])
  const [bridgeStatus, setBridgeStatus] = useState('')
  const [testing, setTesting] = useState(false)
  const pressCount = useRef(0)
  const [trace, setTrace] = useState<string[]>([])
  const held = useRef(new Set<string>())
  const draft = useRef<Mapping>({ big: '', small: '' })
  const callback = useRef(onAction)
  callback.current = onAction

  useEffect(() => {
    if (!enabled && !testing && step === null) return
    let pending: Button | null = null
    let timer = 0
    const clear = () => { window.clearTimeout(timer); pending = null }
    let burstTimer = 0
    const signals = new Set<string>()
    const press = (signal: string) => {
      if (testing) {
        const number = ++pressCount.current
        setTrace(rows => [...rows.slice(-23), `Press #${number}: ${signal}`])
        return
      }
      if (step !== null) {
        const button = step % 2 === 0 ? 'big' : 'small'
        if (step === 1 && signal === draft.current.big || step >= 2 && signal !== draft.current[button]) {
          setMessage('Buttons did not match. Try again.')
          setStep(0)
          return
        }
        draft.current[button] = signal
        setMessage(signal)
        if (step < 3) setStep(step + 1)
        else {
          const confirmed = { ...draft.current }
          setMapping(confirmed)
          try { localStorage.setItem(storageKey, JSON.stringify(confirmed)) } catch { /* Session binding still works. */ }
          setStep(null)
          setMessage('Both buttons verified')
        }
        return
      }
      if (!mapping || (signal !== mapping.big && signal !== mapping.small)) return
      const button = signal === mapping.big ? 'big' : 'small'
      if (pending === button) {
        clear()
        callback.current(button === 'big', true)
        return
      }
      if (pending) callback.current(pending === 'big', false)
      clear()
      pending = button
      timer = window.setTimeout(() => { clear(); callback.current(button === 'big', false) }, 350)
    }
    const receive = (event: KeyboardEvent) => {
      if (document.hidden || event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.code && event.code !== 'Unidentified' ? event.code : event.key
      if (!key || ['Tab', 'Escape', 'Unidentified'].includes(key)) return
      if (!testing && step === null && ![mapping?.big, mapping?.small].some(keys => keys?.split(' + ').includes(key))) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!macBridge) receiveSignal(key, event.type === 'keyup', event.repeat)
    }
    const receiveSignal = (key: string, released: boolean, repeat = false, device = '') => {
      if (testing) setTrace(rows => [...rows.slice(-23), key + (released ? ' up' : ' down') + (device ? ' ' + device : '')])
      if (released) {
        held.current.delete(key)
        return
      }
      if (repeat || held.current.has(key)) return
      held.current.add(key)
      signals.add(key)
      window.clearTimeout(burstTimer)
      burstTimer = window.setTimeout(() => {
        const signature = [...signals].sort().join(' + ')
        signals.clear()
        press(signature)
      }, 45)
    }
    const teamTimers = new Map<string, number>()
    function scoreDevice(key: string, edge: string, device: string) {
      if (key !== 'HID-0C-E9' && key !== 'HID-0C-EA') return
      if (device !== 'location=1A10C555' && device !== 'location=838C6DA5') return
      const heldKey = device + ':' + key
      if (edge === 'up') {
        held.current.delete(heldKey)
        return
      }
      if (held.current.has(heldKey)) return
      held.current.add(heldKey)
      const right = device === 'location=838C6DA5'
      const side = right ? 'Right' : 'Left'
      setBridgeStatus(side + ' remote received (' + key + ')')
      const pending = teamTimers.get(device)
      if (pending !== undefined) {
        window.clearTimeout(pending)
        teamTimers.delete(device)
        setBridgeStatus(side + ' remote: undo')
        callback.current(right, true)
        return
      }
      teamTimers.set(device, window.setTimeout(() => {
        teamTimers.delete(device)
        setBridgeStatus(side + ' remote: single press applied')
        callback.current(right, false)
      }, 350))
    }
    const cancel = () => {
      for (const timer of teamTimers.values()) window.clearTimeout(timer)
      teamTimers.clear()
      clear()
      window.clearTimeout(burstTimer)
      signals.clear()
      held.current.clear()
    }
    const bridge = macBridge ? new EventSource('/__dev/mac-clicker') : null
    if (bridge) {
      bridge.onopen = () => setBridgeStatus('Browser connected. Checking for AB Shutter3…')
      bridge.onerror = () => {
        bridge.close()
        setBridgeStatus('Mac listener unavailable. Check the dev server and Input Monitoring.')
      }
      bridge.onmessage = ({ data }) => {
        if (document.hidden) return
        if (String(data).startsWith('STATUS ')) {
          setBridgeStatus(String(data).slice(7))
          return
        }
        const [key, edge, device, location] = String(data).split(' ')
        if (clicker && !testing && step === null) {
          scoreDevice(key, edge, location)
          return
        }
        if (!clicker && !testing && step === null && ![mapping?.big, mapping?.small].some(keys => keys?.split(' + ').includes(key))) return
        if (edge === 'down' && !testing) setBridgeStatus('Received ' + key)
        receiveSignal(key, edge === 'up', false, device + ' ' + location)
      }
    }
    window.addEventListener('keydown', receive, true)
    window.addEventListener('keyup', receive, true)
    // System media controls may take focus briefly while a physical press is pending.
    if (!macBridge) window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', cancel)
    return () => {
      bridge?.close()
      cancel()
      window.removeEventListener('keyup', receive, true)
      window.removeEventListener('keydown', receive, true)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', cancel)
    }
  }, [mapping, enabled, step, testing, macBridge, clicker])

  return <details><summary>Shutter remote</summary>
    {import.meta.env.DEV && <button type="button" aria-pressed={macBridge} onClick={() => {
      setMacBridge(!macBridge)
      setEnabled(!macBridge)
      setTesting(false)
      setStep(null)
      pressCount.current = 0; setTrace([])
      setBridgeStatus('')
    }}>Mac clicker bridge</button>}
    {macBridge && bridgeStatus && <p role="status">{bridgeStatus}</p>}
    <button type="button" aria-pressed={testing} onClick={() => { setStep(null); setTesting(!testing); pressCount.current = 0; setTrace([]) }}>
      {testing ? 'End button test' : 'Test buttons'}
    </button>
    {testing && <pre aria-live="polite">{trace.join('\n') || 'Press either button once'}</pre>}
    <button type="button" onClick={() => { setTesting(false); setEnabled(false); setMessage(''); setStep(step === null ? 0 : null) }}>
      {step === null ? 'Learn buttons' : 'Cancel calibration'}
    </button>
    {step !== null && <p role="status">Press the {step % 2 === 0 ? 'big' : 'small'} button {step >= 2 ? 'again' : 'once'}. {message}</p>}
    {step === null && mapping && <><p>{mapping.big}{mapping.small ? ' · ' + mapping.small : ' · Small button awaiting calibration'}</p>
      <button type="button" aria-pressed={enabled} onClick={() => setEnabled(!enabled)}>{enabled ? 'Disable remote' : 'Enable remote'}</button></>}
  </details>
}
