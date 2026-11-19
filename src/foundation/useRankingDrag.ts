import { useEffect, useRef, useState, type PointerEvent } from 'react'

/** Only the handle captures pointers, so card editing and normal touch scrolling stay available. */
export function useRankingDrag(onDrop: (id: string, target: string, after: boolean) => void) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const active = useRef<{ id: string; target: string | null; after: boolean; measuredX: number; measuredY: number; x: number; y: number; startX: number; startY: number; moved: boolean; scroller: HTMLElement | null; handle: HTMLButtonElement; board: HTMLElement | null; pointer: number } | null>(null)
  const [after, setAfter] = useState(false)
  const ghost = useRef<HTMLElement | null>(null)
  const frame = useRef<number | null>(null)
  function cleanup() {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    ghost.current?.remove()
    ghost.current = null
    const drag = active.current
    active.current = null
    drag?.board?.style.removeProperty('--ranking-gap-width')
    if (drag?.handle.hasPointerCapture(drag.pointer)) drag.handle.releasePointerCapture(drag.pointer)
    setDragging(null); setOver(null)
  }
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    ghost.current?.remove()
    active.current?.board?.style.removeProperty('--ranking-gap-width')
  }, [])
  function locate(force = false) {
    const drag = active.current
    if (!drag?.moved) return
    if (!force && drag.x === drag.measuredX && drag.y === drag.measuredY) return
    drag.measuredX = drag.x
    drag.measuredY = drag.y
    const visualHit = document.elementFromPoint(drag.x, drag.y)
    const preview = visualHit?.closest<HTMLElement>('.member-rankings__tile[data-insert]')
    const cardBounds = preview?.querySelector(':scope > button')?.getBoundingClientRect()
    const inGap = cardBounds && (drag.after ? drag.x >= cardBounds.right : drag.x <= cardBounds.left)
    if (preview && preview.dataset.rankId === drag.target && inGap) return

    // Measure without the preview spacing so reflow cannot select a different slot.
    drag.board?.setAttribute('data-measuring-drop', '')
    const hit = document.elementFromPoint(drag.x, drag.y)
    const tier = hit?.closest<HTMLElement>('.member-rankings__tier')
    let row = hit?.closest<HTMLElement>('.member-rankings__tile[data-rank-id]')
    if (!row && tier) {
      let nearest = Infinity
      for (const tile of tier.querySelectorAll<HTMLElement>('.member-rankings__tile[data-rank-id]')) {
        if (tile.dataset.rankId === drag.id) continue
        const bounds = tile.getBoundingClientRect()
        const dx = Math.max(bounds.left - drag.x, 0, drag.x - bounds.right)
        const dy = Math.max(bounds.top - drag.y, 0, drag.y - bounds.bottom)
        const distance = dx * dx + dy * dy
        if (distance < nearest) {
          nearest = distance
          row = tile
        }
      }
    }
    const bounds = row?.querySelector(':scope > button')?.getBoundingClientRect()
    drag.target = row?.dataset.rankId ?? tier?.dataset.rankId ?? null
    drag.after = Boolean(bounds && drag.x >= bounds.left + bounds.width / 2)
    drag.board?.removeAttribute('data-measuring-drop')
    setOver(drag.target)
    setAfter(drag.after)
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
      }
      locate(Boolean(step))
    }
    frame.current = requestAnimationFrame(tick)
  }
  function start(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.isPrimary || event.button !== 0 || active.current) return
    let scroller: HTMLElement | null = event.currentTarget.parentElement
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement
    event.currentTarget.setPointerCapture(event.pointerId)
    active.current = { id, target: id, after: false, measuredX: event.clientX, measuredY: event.clientY, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, scroller, handle: event.currentTarget, board: event.currentTarget.closest('.member-rankings'), pointer: event.pointerId }
    frame.current = requestAnimationFrame(tick)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const drag = active.current
    if (!drag || drag.pointer !== event.pointerId) return
    drag.x = event.clientX; drag.y = event.clientY
    if (!drag.moved && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 5) {
      drag.moved = true
      setDragging(drag.id)
      drag.board?.style.setProperty('--ranking-gap-width', `${drag.handle.getBoundingClientRect().width}px`)
      const preview = document.createElement('div')
      preview.className = 'member-rankings__tile member-rankings__drag-preview'
      preview.setAttribute('aria-hidden', 'true')
      const content = document.createElement('div')
      for (const child of drag.handle.childNodes) content.append(child.cloneNode(true))
      preview.append(content)
      document.body.append(preview)
      ghost.current = preview
    }
    if (ghost.current) {
      ghost.current.style.left = `${drag.x + 12}px`
      ghost.current.style.top = `${drag.y + 12}px`
    }
  }
  function end(event: PointerEvent<HTMLButtonElement>) {
    const drag = active.current
    if (!drag || drag.pointer !== event.pointerId) return
    if (drag.moved && (!drag.target || Math.hypot(event.clientX - drag.measuredX, event.clientY - drag.measuredY) > 0)) {
      drag.x = event.clientX
      drag.y = event.clientY
      locate(true)
    }
    const commit = drag.moved && drag.target !== drag.id
    cleanup()
    if (commit && drag.target) onDrop(drag.id, drag.target, drag.after)
  }
  return { dragging, over, after, start, move, end, cancel: cleanup }
}
