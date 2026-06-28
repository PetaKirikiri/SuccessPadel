import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import '../gameCard/gameCard.tv.css'
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
  onGameChange?: (gameNumber: number) => void
  className?: string
  t: TranslateFn
}

const SWIPE_THRESHOLD_PX = 48

export function TvGameCarousel({
  gameNumbers,
  activeGameNumber,
  renderGame,
  onGameChange,
  className = '',
}: Props) {
  const [index, setIndex] = useState(0)
  const userNavigatedRef = useRef(false)
  const initializedRef = useRef(false)
  const touchStartXRef = useRef<number | null>(null)

  useEffect(() => {
    if (activeGameNumber == null || gameNumbers.length === 0) return
    const activeIdx = gameNumbers.indexOf(activeGameNumber)
    if (activeIdx < 0) return

    if (!initializedRef.current) {
      setIndex(activeIdx)
      initializedRef.current = true
      return
    }

    if (!userNavigatedRef.current) {
      setIndex(activeIdx)
    }
  }, [activeGameNumber, gameNumbers.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        userNavigatedRef.current = true
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'ArrowRight') {
        userNavigatedRef.current = true
        setIndex((i) => Math.min(gameNumbers.length - 1, i + 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameNumbers.length])

  const current = gameNumbers[index] ?? gameNumbers[0]
  const atStart = index <= 0
  const atEnd = index >= gameNumbers.length - 1
  const nav: TvGameNav = {
    onPrev: () => {
      userNavigatedRef.current = true
      setIndex((i) => Math.max(0, i - 1))
    },
    onNext: () => {
      userNavigatedRef.current = true
      setIndex((i) => Math.min(gameNumbers.length - 1, i + 1))
    },
    atStart,
    atEnd,
  }

  useEffect(() => {
    if (current != null) onGameChange?.(current)
  }, [current, onGameChange])

  if (gameNumbers.length === 0) return null

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? e.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (startX == null) return
    const endX = e.changedTouches[0]?.clientX
    if (endX == null) return
    const delta = endX - startX
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    userNavigatedRef.current = true
    if (delta < 0) nav.onNext()
    else nav.onPrev()
  }

  return (
    <div
      className={`tv-game-carousel play-game-carousel relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden${className ? ` ${className}` : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {renderGame(current!, nav)}
    </div>
  )
}
