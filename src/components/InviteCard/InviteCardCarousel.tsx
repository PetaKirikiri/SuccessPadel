import {
  Children,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from 'react'

/*
 * UI/layout lock:
 * Do not tune invite carousel spacing, height, scrolling, or viewport behavior here.
 * Do not add classes/hooks for UI work without explicit approval.
 * Put visual changes in src/layouts/invite/invite.{mobile,tablet,web,tv}.css
 * or hub.layout.css.
 */

export type InviteCarouselNav = {
  onPrev: () => void
  onNext: () => void
  atStart: boolean
  atEnd: boolean
  show: boolean
}

const InviteCarouselNavContext = createContext<InviteCarouselNav | null>(null)

const SWIPE_THRESHOLD_PX = 48

export function useInviteCarouselNav(): InviteCarouselNav | null {
  return useContext(InviteCarouselNavContext)
}

type Props = {
  children: ReactNode
  className?: string
}

export function InviteCardCarousel({ children, className = '' }: Props) {
  const items = useMemo(() => Children.toArray(children), [children])
  const [index, setIndex] = useState(0)
  const touchStartXRef = useRef<number | null>(null)
  const count = items.length
  const atStart = index <= 0
  const atEnd = index >= count - 1

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, count - 1)))
  }, [count])

  const nav: InviteCarouselNav = useMemo(
    () => ({
      onPrev: () => setIndex((i) => Math.max(0, i - 1)),
      onNext: () => setIndex((i) => Math.min(count - 1, i + 1)),
      atStart,
      atEnd,
      show: count > 1,
    }),
    [atStart, atEnd, count],
  )

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? e.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (!nav.show) return
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX == null) return
    const endX = e.changedTouches[0]?.clientX
    if (endX == null) return
    const delta = endX - startX
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    if (delta < 0) nav.onNext()
    else nav.onPrev()
  }

  if (count === 0) return null

  return (
    <InviteCarouselNavContext.Provider value={nav}>
      <div
        className={`invite-card-carousel ${className}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {items[index] ?? null}
      </div>
    </InviteCarouselNavContext.Provider>
  )
}
