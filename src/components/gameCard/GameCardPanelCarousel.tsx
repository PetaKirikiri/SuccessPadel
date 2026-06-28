import { useEffect, useRef, type ReactNode } from 'react'

export type GameCardPanel = 'game' | 'leaderboard'

type Props = {
  activePanel: GameCardPanel
  onActivePanel: (panel: GameCardPanel) => void
  gamePanel: ReactNode
  leaderboardPanel: ReactNode
}

function panelIndex(panel: GameCardPanel): number {
  return panel === 'game' ? 0 : 1
}

/** Swipe game courts ↔ leaderboard — header trophy toggles; no side arrows. */
export function GameCardPanelCarousel({
  activePanel,
  onActivePanel,
  gamePanel,
  leaderboardPanel,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef(activePanel)
  panelRef.current = activePanel

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const targetLeft = panelIndex(activePanel) * scroller.clientWidth
    if (Math.abs(scroller.scrollLeft - targetLeft) < 2) return
    scroller.scrollTo({ left: targetLeft, behavior: 'smooth' })
  }, [activePanel])

  const onScroll = () => {
    const scroller = scrollerRef.current
    if (!scroller || scroller.clientWidth <= 0) return
    const index = Math.round(scroller.scrollLeft / scroller.clientWidth)
    const next: GameCardPanel = index <= 0 ? 'game' : 'leaderboard'
    if (next !== panelRef.current) onActivePanel(next)
  }

  return (
    <div className="game-card-panel-carousel flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="invite-card-carousel game-card-panel-carousel-track min-h-0 min-w-0 flex-1"
      >
        <div className="invite-card-carousel-item flex min-h-0 flex-col">{gamePanel}</div>
        <div className="invite-card-carousel-item flex min-h-0 flex-col overflow-hidden">
          <div className="game-card-panel-carousel-scroll min-h-0 flex-1 overflow-y-auto">{leaderboardPanel}</div>
        </div>
      </div>
    </div>
  )
}
