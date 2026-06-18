import { useEffect, useState, type ReactNode } from 'react'
import type { TranslateFn } from '../../i18n'

export type TvGameNav = {
  onPrev: () => void
  onNext: () => void
  atStart: boolean
  atEnd: boolean
}

type Props = {
  gameNumbers: number[]
  activeGameNumber?: number
  renderGame: (gameNumber: number, nav: TvGameNav) => ReactNode
  t: TranslateFn
}

export function CompetitionTvGameCarousel({
  gameNumbers,
  activeGameNumber,
  renderGame,
}: Props) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (activeGameNumber == null) return
    const next = gameNumbers.indexOf(activeGameNumber)
    if (next >= 0) setIndex(next)
  }, [activeGameNumber, gameNumbers])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'ArrowRight') {
        setIndex((i) => Math.min(gameNumbers.length - 1, i + 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameNumbers.length])

  if (gameNumbers.length === 0) return null

  const current = gameNumbers[index] ?? gameNumbers[0]!
  const atStart = index <= 0
  const atEnd = index >= gameNumbers.length - 1
  const nav: TvGameNav = {
    onPrev: () => setIndex((i) => Math.max(0, i - 1)),
    onNext: () => setIndex((i) => Math.min(gameNumbers.length - 1, i + 1)),
    atStart,
    atEnd,
  }

  return (
    <div className="tv-game-carousel flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {renderGame(current, nav)}
    </div>
  )
}
