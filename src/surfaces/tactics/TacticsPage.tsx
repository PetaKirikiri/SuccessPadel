import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { chooseAutomaticShot, clamp, distance, initialTactics, movePlayer } from './tacticsModel'
import type { Point } from './tacticsModel'
import { courtPoint, courtView, drawCourt, screenPoint } from './drawCourt'
import '../../layouts/tactics.layout.css'

export default function TacticsPage() {
  const [state, setState] = useState(initialTactics)
  const [selected, setSelected] = useState('')
  const [size, setSize] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ id: string; pointer: number; offset: Point } | null>(null)
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
    setState(current => {
      if (id === 'ball') return { ...current, ball: {
        x: clamp(point.x, 0.15, 9.85),
        y: point.y < 10 ? clamp(point.y, 0.15, 9.85) : clamp(point.y, 10.15, 19.85),
      } }
      return movePlayer(current, Number(id.replace('player-', '')), point)
    })
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
      { id: 'ball', point: state.ball, radius: 20 },
      ...state.players.map(p => ({ id: `player-${p.id}`, point: p, radius: Math.max(22, view.scale * 0.52) })),
    ]
    const hit = candidates.find(c => distance(screen, screenPoint(c.point, view)) <= c.radius)
    if (!hit && (point.x < 0 || point.x > 10 || point.y < 0 || point.y > 20)) return
    const id = hit?.id ?? 'ball'
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
    setSelected(id)
    drag.current = { id, pointer: event.pointerId, offset: hit ? { x: hit.point.x - point.x, y: hit.point.y - point.y } : { x: 0, y: 0 } }
    if (!hit) move(id, point)
  }
  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || drag.current.pointer !== event.pointerId) return
    const { point } = pointerPoint(event)
    move(drag.current.id, { x: point.x + drag.current.offset.x, y: point.y + drag.current.offset.y })
  }
  function endDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (drag.current?.pointer !== event.pointerId) return
    drag.current = null
    setSelected('')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function keyMove(event: KeyboardEvent, id: string) {
    const steps: Record<string, Point> = { ArrowLeft: { x: -0.25, y: 0 }, ArrowRight: { x: 0.25, y: 0 }, ArrowUp: { x: 0, y: -0.25 }, ArrowDown: { x: 0, y: 0.25 } }
    let step = steps[event.key]
    if (!step) return
    event.preventDefault()
    const canvas = canvasRef.current
    if (canvas && courtView(canvas.clientWidth, canvas.clientHeight).rotated) step = { x: -step.y, y: step.x }
    const point = id === 'ball' ? state.ball : state.players.find(p => `player-${p.id}` === id)
    if (point) move(id, { x: point.x + step.x, y: point.y + step.y })
  }
  return (
    <main className="tactics" aria-label="Padel tactics board">
      <canvas ref={canvasRef} className="tactics__court" aria-label="Drag the players. Drag the ball or tap the court to set its starting position. The heatmap and recommended trajectory update automatically." onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; setSelected('') }} />
      <div className="tactics__accessible-controls">
        {['player-1', 'player-2', 'player-3', 'player-4', 'ball'].map(id => <button type="button" key={id} onFocus={() => setSelected(id)} onBlur={() => setSelected('')} onKeyDown={e => keyMove(e, id)}>{id.replace('-', ' ')}: use arrow keys to move</button>)}
      </div>
    </main>
  )
}
