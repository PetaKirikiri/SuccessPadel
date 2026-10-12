import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { clamp, evaluateShot, chooseAutomaticShot, distance, initialTactics, movePlayer, selectShooter } from './tacticsModel'
import type { Point } from './tacticsModel'
import { courtPoint, courtView, drawCourt, drawShotPlayback, screenPoint } from './drawCourt'
import { playbackTime } from './shotPlayback'
import { Footprints, Target, Hand, Check, ArrowRight, RotateCcw, Gamepad2 } from 'lucide-react'
import { challenges, challengeState, scorePlacement } from './tacticsChallenges'
import type { TacticsMode } from './tacticsChallenges'
import { drawChallenge } from './drawChallenge'
import '../../layouts/tactics.layout.css'

export default function TacticsPage() {
  const [mode, setMode] = useState<TacticsMode>('free')
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [challengeIndex, setChallengeIndex] = useState(0)
  const challenge = challenges[mode === 'placement' ? 'placement' : 'positioning'][challengeIndex]!
  const [state, setState] = useState(initialTactics)
  const freeState = useRef(initialTactics())
  const [choice, setChoice] = useState<Point | null>(null)
  const [result, setResult] = useState<ReturnType<typeof scorePlacement> | null>(null)
  const [results, setResults] = useState<number[]>([])
  const [complete, setComplete] = useState(false)
  const [moved, setMoved] = useState(false)
  const [shotBlocked, setShotBlocked] = useState(false)
  const [selected, setSelected] = useState('')
  const [size, setSize] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ id: string; pointer: number; offset: Point; start: Point; started: number; moved: boolean } | null>(null)
  const lastTap = useRef<{ player: number; time: number } | null>(null)
  const automatic = useMemo(() => mode === 'free' ? chooseAutomaticShot(state) : { state, cells: [], shot: evaluateShot(state) }, [state, mode])

  function startChallenge(nextMode: TacticsMode, index = 0) {
    setModeMenuOpen(false)
    if (mode === 'free') freeState.current = state
    setMode(nextMode); setChallengeIndex(index); setChoice(null); setResult(null); setMoved(false); setShotBlocked(false); setComplete(false)
    setSelected(''); drag.current = null; lastTap.current = null
    if (index === 0) setResults([])
    setState(nextMode === 'free' ? freeState.current : challengeState(challenges[nextMode][index]!))
  }
  function checkAnswer() {
    if (result || mode === 'free') return
    const point = mode === 'placement' ? choice : state.players.find(p => p.id === challenge.player)
    if (!point) return
    const graded = scorePlacement(point, challenge.area)
    const blocked = mode === 'placement' && !automatic.shot.valid
    if (blocked) graded.score = 0
    setShotBlocked(blocked); setResult(graded)
    setResults(current => [...current.slice(0, challengeIndex), graded.score])
  }
  function nextChallenge() {
    if (challengeIndex === challenges[mode === 'placement' ? 'placement' : 'positioning'].length - 1) setComplete(true)
    else startChallenge(mode, challengeIndex + 1)
  }

  useEffect(() => {
    const title = document.title; document.title = 'Padel tactics'
    const existingManifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    const manifest = existingManifest ?? document.createElement('link')
    const previousHref = manifest.getAttribute('href')
    manifest.rel = 'manifest'; manifest.href = '/tactics.webmanifest'
    if (!existingManifest) document.head.append(manifest)
    const metadata = [
      ['theme-color', '#0b252d'],
      ['apple-mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-title', 'Tactics'],
      ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
    ].map(([name, content]) => {
      const existing = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
      const element = existing ?? document.createElement('meta')
      const previous = element.getAttribute('content')
      element.name = name; element.content = content
      if (!existing) document.head.append(element)
      return { element, existing, previous }
    })
    return () => {
      document.title = title
      if (!existingManifest) manifest.remove()
      else if (previousHref === null) manifest.removeAttribute('href')
      else manifest.setAttribute('href', previousHref)
      metadata.forEach(({ element, existing, previous }) => {
        if (!existing) element.remove()
        else if (previous === null) element.removeAttribute('content')
        else element.setAttribute('content', previous)
      })
    }
  }, [])
  useEffect(() => {
    const observer = new ResizeObserver(() => setSize(n => n + 1))
    if (canvasRef.current) observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawCourt(canvas, automatic.state, automatic.cells, automatic.shot, selected, mode !== 'free')
    if (mode !== 'free') drawChallenge(canvas, mode === 'placement' ? choice : null, result ? challenge.area : null,
      mode === 'positioning' ? state.players.find(p => p.id === challenge.player)! : null)
    const background = document.createElement('canvas')
    background.width = canvas.width; background.height = canvas.height
    background.getContext('2d')?.drawImage(canvas, 0, 0)
    const ctx = canvas.getContext('2d')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, started = performance.now()
    function paint(now: number) {
      if (!canvas || !ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(background, 0, 0)
      const time = reducedMotion.matches ? automatic.shot.flight * 0.6 : playbackTime(automatic.shot, (now - started) / 1000)
      if (time !== null && !selected && (mode === 'free' || (mode === 'placement' && result))) drawShotPlayback(canvas, automatic.state, automatic.shot, time)
      if (!document.hidden && !reducedMotion.matches && !selected && (mode === 'free' || (mode === 'placement' && result))) frame = requestAnimationFrame(paint)
    }
    function restart() {
      cancelAnimationFrame(frame)
      started = performance.now()
      paint(started)
    }
    document.addEventListener('visibilitychange', restart)
    reducedMotion.addEventListener('change', restart)
    restart()
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', restart)
      reducedMotion.removeEventListener('change', restart)
    }
  }, [automatic, selected, size, mode, choice, result, challenge, state.players])

  function move(id: string, point: Point) {
    if (!id || (mode !== 'free' && (result || complete))) return
    if (mode === 'placement') {
      const target = { x: clamp(point.x, 0.2, 9.8), y: clamp(point.y, 0.2, 9.8) }
      setChoice(target); setMoved(true); setState(current => ({ ...current, target })); return
    }
    if (mode === 'positioning' && id !== `player-${challenge.player}`) return
    setMoved(true)
    setState(current => movePlayer(current, Number(id.replace('player-', '')), point))
  }
  function pointerPoint(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const view = courtView(rect.width, rect.height)
    return { screen, view, point: courtPoint(screen, view) }
  }
  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (drag.current || !event.isPrimary || (mode !== 'free' && (result || complete))) return
    // Browsers require a real user gesture for fullscreen; unsupported phones
    // keep the same edge-to-edge court and can launch via the Home Screen manifest.
    if (mode === 'free' && event.pointerType === 'touch' && document.fullscreenEnabled && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    }
    const { screen, point, view } = pointerPoint(event)
    if (mode === 'placement') {
      if (point.x < 0 || point.x > 10 || point.y < 0 || point.y > 10) return
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
      move('target', point); setSelected('target')
      drag.current = { id: 'target', pointer: event.pointerId, offset: { x: 0, y: 0 }, start: screen, started: event.timeStamp, moved: true }
      return
    }
    // A generous invisible footprint helps fingers grab the piece without covering it.
    // Choose the nearest centre when footprints overlap, rather than roster order.
    const radius = Math.max(event.pointerType === 'touch' ? 36 : 28, view.scale * 0.68)
    const hit = state.players
      .filter(p => mode === 'free' || p.id === challenge.player)
      .map(p => ({ id: `player-${p.id}`, point: p, gap: distance(screen, screenPoint(p, view)) }))
      .filter(p => p.gap <= radius)
      .sort((a, b) => a.gap - b.gap)[0]
    if (!hit && mode !== 'free') return
    if (!hit && (point.x < 0 || point.x > 10 || point.y < 0 || point.y > 20)) return
    // Empty court only listens for nearby double-taps; the ball is never draggable.
    const id = hit?.id ?? ''
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
    setSelected(id)
    drag.current = { id, pointer: event.pointerId, offset: hit ? { x: hit.point.x - point.x, y: hit.point.y - point.y } : { x: 0, y: 0 }, start: screen, started: event.timeStamp, moved: false }
  }
  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || drag.current.pointer !== event.pointerId) return
    const { point, screen } = pointerPoint(event)
    if (distance(screen, drag.current.start) > 4) drag.current.moved = true
    if (!drag.current.moved) return
    move(drag.current.id, { x: point.x + drag.current.offset.x, y: point.y + drag.current.offset.y })
  }
  function endDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (drag.current?.pointer !== event.pointerId) return
    const gesture = drag.current
    const { screen, view } = pointerPoint(event)
    if (mode === 'free' && event.type === 'pointerup' && !gesture.moved && distance(screen, gesture.start) <= 10 && event.timeStamp - gesture.started <= 350) {
      const nearby = state.players
        .map(p => ({ player: p, gap: distance(screen, screenPoint(p, view)) }))
        .filter(p => p.gap <= Math.max(44, view.scale * 0.9))
        .sort((a, b) => a.gap - b.gap)[0]?.player
      if (nearby && lastTap.current?.player === nearby.id && event.timeStamp - lastTap.current.time <= 400) {
        setState(current => selectShooter(current, nearby.id))
        lastTap.current = null
      } else lastTap.current = nearby ? { player: nearby.id, time: event.timeStamp } : null
    } else lastTap.current = null
    drag.current = null
    setSelected('')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function keyMove(event: KeyboardEvent, id: string) {
    if (mode === 'free' && (event.key === 'Enter' || event.key === ' ') && id.startsWith('player-')) {
      event.preventDefault()
      setState(current => selectShooter(current, Number(id.replace('player-', ''))))
      return
    }
    const steps: Record<string, Point> = { ArrowLeft: { x: -0.25, y: 0 }, ArrowRight: { x: 0.25, y: 0 }, ArrowUp: { x: 0, y: -0.25 }, ArrowDown: { x: 0, y: 0.25 } }
    let step = steps[event.key]
    if (!step) return
    event.preventDefault()
    const canvas = canvasRef.current
    if (canvas && courtView(canvas.clientWidth, canvas.clientHeight).rotated) step = { x: -step.y, y: step.x }
    const point = mode === 'placement' ? choice ?? { x: 5, y: 5 } : state.players.find(p => `player-${p.id}` === id)
    if (point) move(id, { x: point.x + step.x, y: point.y + step.y })
  }
  return (
    <main className="tactics" aria-label="Padel tactics board">
      {mode !== 'free' && <header className="tactics__challenge">
        <span className="tactics__progress">{complete ? 'Complete' : `${challengeIndex + 1} / ${challenges[mode].length}`}</span>
        <div><h1>{complete ? 'Round complete' : challenge.title}</h1><p>{complete ? 'Play again or try the other mode.' : challenge.prompt}</p></div>
      </header>}
      <div className="tactics__court-wrap">
      <nav className="tactics__modes" aria-label="Tactics modes" onKeyDown={event => { if (event.key === 'Escape') setModeMenuOpen(false) }}>
        <button type="button" aria-expanded={modeMenuOpen} aria-controls="tactics-mode-options" onClick={() => setModeMenuOpen(open => !open)}><Gamepad2 aria-hidden="true" />Modes</button>
        {modeMenuOpen && <div className="tactics__mode-options" id="tactics-mode-options">
          <button type="button" aria-pressed={mode === 'positioning'} onClick={() => startChallenge('positioning')}><Footprints aria-hidden="true" />Positioning</button>
          <button type="button" aria-pressed={mode === 'placement'} onClick={() => startChallenge('placement')}><Target aria-hidden="true" />Ball placement</button>
          <button type="button" aria-pressed={mode === 'free'} onClick={() => startChallenge('free')}><Hand aria-hidden="true" />Free play</button>
        </div>}
      </nav>
      <canvas ref={canvasRef} className="tactics__court" aria-label={mode === 'free' ? 'Drag players; double-tap a player to choose the shooter.' : mode === 'positioning' ? `Move player ${challenge.player}. ${challenge.prompt}` : `Tap the opponents’ half to choose a landing spot. ${challenge.prompt}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; setSelected('') }} />
      <div className="tactics__accessible-controls">
        {(mode === 'free' ? ['player-1', 'player-2', 'player-3', 'player-4'] : mode === 'positioning' ? [`player-${challenge.player}`] : ['target']).map(id => <button type="button" key={id} onFocus={() => setSelected(id)} onBlur={() => setSelected('')} onKeyDown={e => keyMove(e, id)}>{id.replace('-', ' ')}: use arrow keys to move{mode === 'free' ? '; Enter to select shooter' : ''}</button>)}
      </div>
      </div>
      {mode !== 'free' && <footer className="tactics__feedback">
        <div className="tactics__feedback-copy" aria-live="polite">
          {complete ? <><strong>{results.reduce((sum, score) => sum + score, 0)} / {challenges[mode].length * 100}</strong><span>Round score · Practice zones</span></>
          : result ? <><strong>{result.score} / 100 <span>{shotBlocked ? 'Shot hits the net' : result.metres < 0.005 ? 'In the target zone' : `${result.metres.toFixed(1)} m from the zone`}</span></strong><p>{shotBlocked ? 'Give the ball more room to cross the net.' : challenge.tip}</p></>
          : <span>{mode === 'positioning' ? `Drag the outlined player ${challenge.player}.` : 'Tap a landing spot on the far half.'}</span>}
        </div>
        {complete ? <button type="button" onClick={() => startChallenge(mode)}><RotateCcw aria-hidden="true" />Play again</button>
          : result ? <button type="button" onClick={nextChallenge}><ArrowRight aria-hidden="true" />{challengeIndex === challenges[mode].length - 1 ? 'Finish' : 'Next'}</button>
          : <button type="button" disabled={!moved} onClick={checkAnswer}><Check aria-hidden="true" />{mode === 'placement' ? 'Play' : 'Check'}</button>}
      </footer>}
    </main>
  )
}
