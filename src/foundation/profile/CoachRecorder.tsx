import { useEffect, useId, useRef, useState } from 'react'
import { Mic, Square, Send, X, RotateCcw } from 'lucide-react'
import { sendCoachRecording } from '../../lib/coachFeedback'

type Props = { playerId: string; playerName: string; competitionId: string | null; onSaved: () => void; compact?: boolean }
type Phase = 'idle' | 'requesting' | 'recording' | 'ready' | 'sending'

export function CoachRecorder({ playerId, playerName, competitionId, onSaved, compact = false }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const mounted = useRef(true)
  const generation = useRef(0)
  const submissionId = useRef('')
  const started = useRef(0)
  const busy = useRef(false)
  const titleId = useId()

  function release() {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
  }
  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop()
    release()
  }
  function discard() {
    generation.current += 1
    if (recorder.current) recorder.current.onstop = null
    stop()
    setBlob(null); setPhase('idle'); setError(null)
    dialog.current?.close()
  }
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current += 1; if (recorder.current) recorder.current.onstop = null; stop() }
  }, [])
  useEffect(() => {
    if (!blob) { setAudioUrl(null); return }
    const url = URL.createObjectURL(blob)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])
  useEffect(() => {
    if (phase === 'idle') return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  async function start() {
    if (busy.current || phase === 'recording' || phase === 'requesting') return
    dialog.current?.showModal()
    setError(null); setBlob(null); setSeconds(0); setPhase('requesting')
    const request = ++generation.current
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Recording needs HTTPS and a browser with microphone support. Try Safari or Chrome.')
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (!mounted.current || generation.current !== request) { media.getTracks().forEach(track => track.stop()); return }
      stream.current = media
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      const capture = new MediaRecorder(media, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 })
      recorder.current = capture
      const chunks: Blob[] = []
      let size = 0
      capture.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size > 1900000 && capture.state === 'recording') stop() } }
      capture.onstop = () => {
        release()
        if (!mounted.current || generation.current !== request) return
        const recording = new Blob(chunks, { type: capture.mimeType })
        const duration = Math.min(120, Math.max(1, Math.ceil((Date.now() - started.current) / 1000)))
        setSeconds(duration)
        if (recording.size < 100) { setError('No audio captured. Please try again.'); setPhase('idle'); return }
        submissionId.current = crypto.randomUUID()
        setBlob(recording); setPhase('ready')
      }
      capture.onerror = () => { setError('The microphone stopped unexpectedly. Please record again.'); stop() }
      started.current = Date.now()
      capture.start(500)
      setPhase('recording')
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started.current) / 1000)
        setSeconds(Math.min(120, elapsed))
        if (elapsed >= 120) stop()
      }, 250)
    } catch (e) {
      release()
      if (!mounted.current || generation.current !== request) return
      setPhase('idle')
      setError(e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow it in browser settings, then try again.'
        : e instanceof Error ? e.message : 'Could not start the microphone.')
    }
  }
  async function send() {
    if (!blob || busy.current) return
    busy.current = true; setPhase('sending'); setError(null)
    try {
      await sendCoachRecording({ id: submissionId.current, playerId, competitionId, blob, seconds })
      if (!mounted.current) return
      setBlob(null); setPhase('idle'); dialog.current?.close(); onSaved()
    } catch (e) {
      if (!mounted.current) return
      setPhase('ready')
      setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Processing is taking longer than expected. Wait a moment and retry; the same recording will not create a duplicate.')
    } finally { busy.current = false }
  }
  return <>
    <button className="coach-record-trigger" type="button" onClick={() => void start()} aria-label={`Record coach feedback for ${playerName}`}>
      <Mic aria-hidden="true" />{compact ? null : <span>Coach note</span>}
    </button>
    <dialog ref={dialog} className="coach-recorder" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy.current) discard() }}>
      <header><div><span>Coaches Comment</span><h2 id={titleId}>{playerName}</h2></div><button type="button" onClick={discard} disabled={phase === 'sending'} aria-label="Discard and close"><X aria-hidden="true" /></button></header>
      <div className="coach-recorder__status" role="status" aria-live="polite" data-recording={phase === 'recording'}>
        <Mic aria-hidden="true" /><strong>{phase === 'sending' ? 'Transcribing & organising…' : phase === 'requesting' ? 'Allow microphone access' : phase === 'recording' ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : blob ? 'Listen before saving' : 'Ready to record'}</strong>
      </div>
      <p className="coach-recorder__hint">{phase === 'sending' ? 'Saving this observation to the player’s skill profile. Keep this open.' : 'Up to 2 minutes. Audio is transcribed with OpenAI; the saved comment appears on the player’s profile.'}</p>
      {audioUrl && phase !== 'sending' ? <audio controls src={audioUrl} /> : null}
      {error ? <p className="coach-recorder__error" role="alert">{error}</p> : null}
      <footer>
        {phase === 'recording' ? <button type="button" onClick={stop}><Square aria-hidden="true" />Stop recording</button> : null}
        {phase === 'idle' || phase === 'ready' ? <button type="button" onClick={() => void start()}><RotateCcw aria-hidden="true" />{blob ? 'Record again' : 'Try recording'}</button> : null}
        {blob ? <button type="button" className="coach-recorder__send" onClick={() => void send()} disabled={phase === 'sending'}><Send aria-hidden="true" />{phase === 'sending' ? 'Saving…' : 'Accept & save'}</button> : null}
      </footer>
    </dialog>
  </>
}
