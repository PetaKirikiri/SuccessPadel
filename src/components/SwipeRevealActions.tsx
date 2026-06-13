import { useRef, useState, type ReactNode } from 'react'
import { IconDelete } from './ButtonIcons'

const ACTION_WIDTH = 80
const OPEN_THRESHOLD = 36

type Props = {
  enabled: boolean
  actionLabel: string
  onAction: () => void
  children: ReactNode
}

export function SwipeRevealActions({ enabled, actionLabel, onAction, children }: Props) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef({ x: 0, y: 0, base: 0 })
  const draggingRef = useRef(false)
  const actionFiredRef = useRef(false)

  if (!enabled) return <>{children}</>

  const snapOffset = (value: number) => (value < -OPEN_THRESHOLD ? -ACTION_WIDTH : 0)

  const beginDrag = (x: number, y: number) => {
    startRef.current = { x, y, base: offset }
    draggingRef.current = true
    setDragging(true)
  }

  const moveDrag = (x: number, y: number, preventScroll?: () => void) => {
    if (!draggingRef.current) return
    const dx = x - startRef.current.x
    const dy = y - startRef.current.y
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      preventScroll?.()
      setOffset(Math.min(0, Math.max(-ACTION_WIDTH, startRef.current.base + dx)))
    }
  }

  const finishDrag = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    setOffset((prev) => snapOffset(prev))
  }

  const dragHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (touch) beginDrag(touch.clientX, touch.clientY)
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (touch) moveDrag(touch.clientX, touch.clientY, () => e.preventDefault())
    },
    onTouchEnd: () => finishDrag(),
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return
      beginDrag(e.clientX, e.clientY)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      moveDrag(e.clientX, e.clientY)
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      finishDrag()
    },
    onPointerCancel: () => finishDrag(),
  }

  const fireAction = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (actionFiredRef.current) return
    actionFiredRef.current = true
    window.setTimeout(() => {
      actionFiredRef.current = false
    }, 400)
    draggingRef.current = false
    setDragging(false)
    setOffset(0)
    onAction()
  }

  return (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl">
      <button
        type="button"
        onPointerUp={fireAction}
        onClick={fireAction}
        className="absolute inset-y-0 right-0 z-0 flex w-20 touch-manipulation select-none flex-col items-center justify-center gap-0.5 bg-red-600 px-1 text-center text-xs font-semibold text-white"
      >
        <IconDelete className="h-4 w-4" />
        {actionLabel}
      </button>
      <div
        className="relative z-10 w-full min-w-0 max-w-full touch-pan-y will-change-transform"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
        }}
        {...dragHandlers}
      >
        {children}
      </div>
    </div>
  )
}
