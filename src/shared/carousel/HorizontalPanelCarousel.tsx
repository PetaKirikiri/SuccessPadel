import { Children, type ReactNode } from 'react'
import { useHorizontalPanelCarousel } from './useHorizontalPanelCarousel'

type Props = {
  activeIndex: number
  onIndexChange?: (index: number) => void
  getPanelHeader?: (index: number) => ReactNode
  panelClassName?: (index: number) => string
  children: ReactNode
  className?: string
  trackClassName?: string
}

export function HorizontalPanelCarousel({
  activeIndex,
  onIndexChange,
  getPanelHeader,
  panelClassName,
  children,
  className = '',
  trackClassName = '',
}: Props) {
  const panels = Children.toArray(children)
  const { trackRef, onScroll } = useHorizontalPanelCarousel({
    activeIndex,
    panelCount: panels.length,
    onIndexChange,
  })

  return (
    <div className={`game-card-panel-carousel flex min-h-0 min-w-0 flex-1 flex-col ${className}`}>
      {getPanelHeader?.(activeIndex)}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className={`game-card-panel-carousel-track min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden ${trackClassName}`}
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {panels.map((panel, index) => (
          <div
            key={index}
            className={`invite-card-carousel-item ${panelClassName?.(index) ?? ''}`}
            style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  )
}
