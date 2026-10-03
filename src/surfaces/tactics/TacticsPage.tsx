import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { chooseAutomaticShot, distance, initialTactics, movePlayer, selectShooter } from './tacticsModel'
import type { Point } from './tacticsModel'
import { courtPoint, courtView, drawCourt, screenPoint } from './drawCourt'
import '../../layouts/tactics.layout.css'

export default function TacticsPage() {
  const [state, setState] = useState(initialTactics)
  const [selected, setSelected] = useState('')
  const [size, setSize] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ id: string; pointer: number; offset: Point; start: Point; started: number; moved: boolean } | null>(null)
  const lastTap = useRef<{ player: number; time: number } | null>(null)
  const automatic = useMemo(() => chooseAutomaticShot(state), [state])

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
    if (canvasRef.current) drawCourt(canvasRef.current, automatic.state, automatic.cells, automatic.shot, selected)
  }, [automatic, selected, size])

  function move(id: string, point: Point) {
    if (!id) return
    setState(current => movePlayer(current, Number(id.replace('player-', '')), point))
  }
  function pointerPoint(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const view = courtView(rect.width, rect.height)
    return { screen, view, point: courtPoint(screen, view) }
  }
  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (drag.current || !event.isPrimary) return
    // Browsers require a real user gesture for fullscreen; unsupported phones
    // keep the same edge-to-edge court and can launch via the Home Screen manifest.
    if (event.pointerType === 'touch' && document.fullscreenEnabled && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    }
    const { screen, point, view } = pointerPoint(event)
    const candidates = [
      ...state.players.map(p => ({ id: `player-${p.id}`, point: p, radius: Math.max(22, view.scale * 0.52) })),
    ]
    const hit = candidates.find(c => distance(screen, screenPoint(c.point, view)) <= c.radius)
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
    if (distance(screen, drag.current.start) > 10) drag.current.moved = true
    if (!drag.current.moved) return
    move(drag.current.id, { x: point.x + drag.current.offset.x, y: point.y + drag.current.offset.y })
  }
  function endDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (drag.current?.pointer !== event.pointerId) return
    const gesture = drag.current
    const { screen, view } = pointerPoint(event)
    if (event.type === 'pointerup' && !gesture.moved && distance(screen, gesture.start) <= 10 && event.timeStamp - gesture.started <= 350) {
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
    if ((event.key === 'Enter' || event.key === ' ') && id.startsWith('player-')) {
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
    const point = state.players.find(p => `player-${p.id}` === id)
    if (point) move(id, { x: point.x + step.x, y: point.y + step.y })
  }
  return (
    <main className="tactics" aria-label="Padel tactics board">
      <canvas ref={canvasRef} className="tactics__court" aria-label="Drag the players. Double-tap or double-click near any player to make them the shooter and switch the attacking side. The ball stays attached to the shooter. Green shadows behind each player show the space they cover; coral gaps are unscreened. Curved arrows with dashed landing rings show optional lobs." onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; setSelected('') }} />
      <div className="tactics__accessible-controls">
        {['player-1', 'player-2', 'player-3', 'player-4'].map(id => <button type="button" key={id} onFocus={() => setSelected(id)} onBlur={() => setSelected('')} onKeyDown={e => keyMove(e, id)}>{id.replace('-', ' ')}: use arrow keys to move{id.startsWith('player-') ? '; Enter to select shooter' : ''}</button>)}
      </div>
    </main>
  )
}
