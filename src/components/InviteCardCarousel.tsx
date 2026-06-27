import { useRef, type ReactNode } from 'react'
import { GamesGenderFilterBannerOverlay } from './GamesGenderFilterButtons'

type Props = {
  children: ReactNode
  className?: string
}

export function InviteCardCarousel({ children, className = '' }: Props) {
  const scrollerRef = useRef<HTMLUListElement>(null)

  const move = (direction: -1 | 1) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollBy({ left: direction * scroller.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      <GamesGenderFilterBannerOverlay />
      <button type="button" aria-label="Previous game" onClick={() => move(-1)} className="invite-carousel-btn invite-carousel-btn-left">
        ‹
      </button>
      <ul ref={scrollerRef} className="invite-card-carousel m-0 flex w-full min-w-0 max-w-full list-none gap-3 overflow-x-auto overflow-y-hidden p-0">
        {children}
      </ul>
      <button type="button" aria-label="Next game" onClick={() => move(1)} className="invite-carousel-btn invite-carousel-btn-right">
        ›
      </button>
    </div>
  )
}
