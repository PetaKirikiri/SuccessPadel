import { useEffect, useRef, useState, type PointerEvent } from 'react'

/** Only the handle captures pointers, so card editing and normal touch scrolling stay available. */
export function useRankingDrag(onDrop: (id: string, target: string) => void) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const active = useRef<{ id: string; target: string; x: number; y: number; startX: number; startY: number; moved: boolean; scroller: HTMLElement | null; handle: HTMLButtonElement; pointer: number } | null>(null)
  const frame = useRef<number | null>(null)
  function cleanup() {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    const drag = active.current
    active.current = null
    if (drag?.handle.hasPointerCapture(drag.pointer)) drag.handle.releasePointerCapture(drag.pointer)
    setDragging(null); setOver(null)
  }
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current) }, [])
  function locate() {
    const drag = active.current
    if (!drag?.moved) return
    const row = document.elementFromPoint(drag.x, drag.y)?.closest<HTMLElement>('[data-rank-id]')
    const id = row?.dataset.rankId
    if (id) { drag.target = id; setOver(id) }
  }
  function tick() {
    const drag = active.current
    if (!drag) return
    if (drag.moved) {
      const rect = drag.scroller?.getBoundingClientRect()
      const top = Math.max(0, rect?.top ?? 0), bottom = Math.min(window.innerHeight, rect?.bottom ?? window.innerHeight)
      const step = drag.y < top + 60 ? -12 : drag.y > bottom - 60 ? 12 : 0
      if (step) {
        if (drag.scroller) drag.scroller.scrollBy(0, step)
        else window.scrollBy(0, step)
        locate()
      }
    }
    frame.current = requestAnimationFrame(tick)
  }
  function start(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.isPrimary || event.button !== 0 || active.current) return
    let scroller: HTMLElement | null = event.currentTarget.parentElement
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement
    event.currentTarget.setPointerCapture(event.pointerId)
    active.current = { id, target: id, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, scroller, handle: event.currentTarget, pointer: event.pointerId }
    frame.current = requestAnimationFrame(tick)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const drag = active.current
    if (!drag || drag.pointer !== event.pointerId) return
    drag.x = event.clientX; drag.y = event.clientY
    if (!drag.moved && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 5) { drag.moved = true; setDragging(drag.id) }
    locate()
  }
  function end(event: PointerEvent<HTMLButtonElement>) {
    const drag = active.current
    if (!drag || drag.pointer !== event.pointerId) return
    const commit = drag.moved && drag.target !== drag.id
    cleanup()
    if (commit) onDrop(drag.id, drag.target)
  }
  return { dragging, over, start, move, end, cancel: cleanup }
}
