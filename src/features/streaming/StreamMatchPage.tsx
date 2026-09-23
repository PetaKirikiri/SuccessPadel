import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { streamingApi, streamingEnabled, type StreamMatch, type StreamStatus } from './api'
import { CourtPublisher } from './publisher'
import './streaming.css'
const key = (m: StreamMatch) => `${m.round_id}/${m.court_id}`
export function StreamMatchPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const [matches,setMatches] = useState<StreamMatch[]>([])
  const [selection,setSelection] = useState('')
  const [status,setStatus] = useState<StreamStatus | null>(null)
  const [active,setActive] = useState<StreamStatus[]>([])
  const [admin,setAdmin] = useState(false)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [preview,setPreview] = useState(false)
  const [elapsed,setElapsed] = useState(0)
  const [now,setNow] = useState(() => Date.now())
  const [connection,setConnection] = useState('Camera off')
  const [operatorSearch,setOperatorSearch] = useState('')
  const [operators,setOperators] = useState<{id:string;display_name:string}[]>([])
  const [notice,setNotice] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const camera = useRef<CourtPublisher | null>(null)
  const current = useRef<StreamStatus | null>(null)
  const alive = useRef(true)
  const match = matches.find(m => key(m) === selection)
  const streamId = status?.id
  const streamState = status?.state
  const running = status && !['failed','complete'].includes(status.state)
  useEffect(() => {
    alive.current = true
    if (streamingEnabled) {
      void streamingApi<{matches:StreamMatch[];isAdmin:boolean}>(`/matches${id ? `?session=${encodeURIComponent(id)}` : ''}`).then(data => {
        if (!alive.current) return
        setMatches(data.matches); setAdmin(data.isAdmin)
        const available = data.matches.filter(m => m.status !== 'complete' && Date.parse(m.ends_at) > Date.now())
        const chosen = available.find(m => m.court_id === params.get('court')) ?? available[0]
        setSelection(chosen ? key(chosen) : '')
      }).catch(e => { if (alive.current) setError(e.message) })
      void streamingApi<{streams:StreamStatus[]}>('/active').then(data => { if (alive.current) setActive(data.streams) }).catch(() => {})
    }
    return () => {
      alive.current = false; camera.current?.close()
      if (current.current && !['complete','failed'].includes(current.current.state)) void streamingApi(`/streams/${current.current.id}/stop`,{}).catch(() => {})
    }
  },[id,params])
  useEffect(() => {
    if (!streamId || !streamState || ['failed','complete'].includes(streamState)) return
    let polling = false
    const poll = async () => {
      if (polling) return
      polling = true
      try {
        const connected = camera.current?.peer?.connectionState === 'connected' && camera.current.media?.getTracks().every(track => track.readyState === 'live')
        const next = await streamingApi<StreamStatus>(`/streams/${streamId}${connected ? '/heartbeat' : ''}`,connected ? {} : undefined)
        if (alive.current) {
          current.current = next; setStatus(next)
          if (['failed','complete','stopping'].includes(next.state)) { camera.current?.close(); setPreview(false) }
        }
      } catch(e) { if (alive.current) setError(e instanceof Error ? e.message : 'Connection interrupted') }
      finally { polling = false }
    }
    const timer = window.setInterval(() => void poll(),5000)
    return () => clearInterval(timer)
  },[streamId,streamState])
  useEffect(() => {
    let lastBytes = 0, lastTime = 0
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if (current.current?.live_at) setElapsed(Math.max(0,Math.floor((Date.now()-Date.parse(current.current.live_at))/1000)))
      const peer = camera.current?.peer
      if (!peer) return
      setConnection(peer.connectionState === 'connected' ? 'Camera connected' : `Camera: ${peer.connectionState}`)
      void peer.getStats().then(stats => {
        if (!alive.current || peer !== camera.current?.peer) return
        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            if (lastTime && report.timestamp > lastTime && peer.connectionState === 'connected') setConnection(`Camera connected · ${((report.bytesSent-lastBytes)*8/(report.timestamp-lastTime)/1000).toFixed(1)} Mbps sent`)
            lastBytes=report.bytesSent; lastTime=report.timestamp
          }
        })
      }).catch(() => {})
    },1000)
    const visible = () => { if (document.visibilityState === 'visible') void camera.current?.keepAwake() }
    document.addEventListener('visibilitychange',visible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange',visible) }
  },[])
  async function openCamera() {
    setBusy(true); setError('')
    const publisher = new CourtPublisher(); camera.current?.close(); camera.current=publisher
    try {
      const media = await publisher.camera()
      if (!alive.current) return
      if (video.current) { video.current.srcObject=media; await video.current.play() }
      setPreview(true); setConnection('Camera ready')
    } catch(e) { publisher.close(); if (alive.current) setError(e instanceof Error ? e.message : 'Camera permission was not granted') }
    finally { if (alive.current) setBusy(false) }
  }
  async function start() {
    if (!match || !camera.current) return
    setBusy(true); setError('')
    let created: StreamStatus | null = null
    try {
      created = await streamingApi<StreamStatus>('/streams',{session_id:match.session_id,round_id:match.round_id,court_id:match.court_id})
      current.current=created
      if (!alive.current) { await streamingApi(`/streams/${created.id}/stop`,{}); return }
      setStatus(created)
      const settings = await streamingApi<{url:string;token:string;iceServers:RTCIceServer[]}>(`/streams/${created.id}/publisher`,{})
      await camera.current.publish(settings)
    } catch(e) {
      camera.current?.close()
      if (created) void streamingApi(`/streams/${created.id}/stop`,{}).catch(() => {})
      if (alive.current) { setPreview(false); setError(e instanceof Error ? e.message : 'Could not start stream') }
    } finally { if (alive.current) setBusy(false) }
  }
  async function stop(streamId = status?.id) {
    const ownCamera = !streamId || streamId === current.current?.id
    if (ownCamera) { camera.current?.close(); setPreview(false); setConnection('Camera off') }
    setBusy(true)
    try {
      if (streamId) { const next=await streamingApi<StreamStatus>(`/streams/${streamId}/stop`,{}); if (ownCamera) { current.current=next; setStatus(next) } else setNotice('Stop requested. The server is finalizing that recording.'); setActive(a=>a.filter(s=>s.id!==streamId)) }
    } catch(e) { setError(`${ownCamera ? 'Camera stopped. ' : ''}${e instanceof Error ? e.message : 'Could not contact server'}. You can retry Stop; the server also expires disconnected cameras.`) }
    finally { setBusy(false) }
  }
  if (!streamingEnabled) return <section className="court-stream"><h1>Stream Match</h1><p>Club streaming has not been configured yet.</p><Link to="/competitive">Back to matches</Link></section>
  return <section className="court-stream">
    <header><h1>Stream Match</h1><p>Success Padel Club · YouTube</p></header>
    {error && <p role="alert" className="court-stream__error">{error}</p>}
    <label>Match and court<select value={selection} disabled={busy || preview || Boolean(running)} onChange={e=>{setSelection(e.target.value);setStatus(null);current.current=null}}>
      <option value="">Select a match</option>
      {matches.filter(m=>m.status!=='complete' && Date.parse(m.ends_at)>now).map(m=><option key={key(m)} value={key(m)}>{m.event_name} · Round {m.round_number} · {m.court_name}</option>)}
    </select></label>
    {!matches.length && <p>No assigned matches are available. A staff member can assign your signed-in account to a court.</p>}
    {match && <div className="court-stream__match"><h2>{match.event_name}</h2><p>{match.court_name} · Round {match.round_number}</p><strong>{match.teams.a.join(' & ')} vs {match.teams.b.join(' & ')}</strong><p>{new Date(match.starts_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · {Math.round((Date.parse(match.ends_at)-Date.parse(match.starts_at))/60000)} minutes expected</p></div>}
    <video ref={video} muted playsInline autoPlay aria-label="Rear camera preview" className="court-stream__preview" hidden={!preview} />
    <p role="status" className="court-stream__status" data-live={status?.state==='live'}>{status?.state==='live' ? '● LIVE on YouTube' : status?.state==='connecting' ? 'Connecting to YouTube…' : status?.state==='stopping' ? 'Finalizing recording…' : status?.state==='complete' ? 'Stream ended. Recording is processing.' : status?.state==='failed' ? 'Stream ended before going live' : connection}{status?.live_at && ` · ${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`}</p>
    {running && <p>{connection}</p>}
    {status?.error && <p>{status.error}</p>}
    <div className="court-stream__actions">
      {!preview && !running && <button disabled={!match || busy} onClick={()=>void openCamera()}>Stream Match</button>}
      {preview && !running && <button disabled={busy} onClick={()=>void start()}>{busy ? 'Starting…' : 'Start Stream'}</button>}
      {(preview || running) && <button disabled={busy} onClick={()=>void stop()}>Stop Stream</button>}
    </div>
    <p>Keep this page open and the phone unlocked. Calls, switching apps, or locking the screen can interrupt the camera. Use Safari or Chrome if an in-app browser cannot open it.</p>
    {active.filter(s=>s.id!==status?.id).map(s=><div key={s.id} className="court-stream__match"><p>{s.title} · {s.state}</p><button disabled={busy} onClick={()=>void stop(s.id)}>Stop this stream</button></div>)}
    {admin && match && <details><summary>Assign a camera operator</summary><p>Search for a customer or staff member who has signed in. Assignment lasts 12 hours.</p><label>Operator name<input value={operatorSearch} onChange={e=>setOperatorSearch(e.target.value)} /></label><button onClick={()=>void streamingApi<{operators:{id:string;display_name:string}[]}>(`/operators?q=${encodeURIComponent(operatorSearch)}`).then(d=>setOperators(d.operators)).catch(e=>setError(e.message))}>Find operator</button>{operators.map(p=><button key={p.id} onClick={()=>void streamingApi('/assign',{session_id:match.session_id,court_id:match.court_id,profile_id:p.id}).then(()=>setNotice(`${p.display_name} can stream ${match.court_name}.`)).catch(e=>setError(e.message))}>Assign {p.display_name}</button>)}<p role="status">{notice}</p></details>}
    <Link to={id ? `/competitions/${id}` : '/competitive'}>Back to matches</Link>
  </section>
}
