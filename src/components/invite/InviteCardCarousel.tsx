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
        className={`relative flex min-h-0 w-full flex-1 flex-col ${className}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {items[index] ?? null}
      </div>
    </InviteCarouselNavContext.Provider>
  )
}
