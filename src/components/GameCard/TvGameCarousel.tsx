import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import './gameCard.tv.css'
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
  autoFollowActiveGame?: boolean
  persistenceKey?: string
  renderGame: (gameNumber: number, nav: TvGameNav) => ReactNode
  onGameChange?: (gameNumber: number) => void
  className?: string
  t: TranslateFn
}

const SWIPE_THRESHOLD_PX = 48

export function TvGameCarousel({
  gameNumbers,
  activeGameNumber,
  autoFollowActiveGame = false,
  persistenceKey,
  renderGame,
  onGameChange,
  className = '',
}: Props) {
  const [index, setIndex] = useState(0)
  const initializedRef = useRef(false)
  const skipFirstPersistenceWriteRef = useRef(true)
  const touchStartXRef = useRef<number | null>(null)

  useEffect(() => {
    if (gameNumbers.length === 0) return
    if (!initializedRef.current) {
      const persistedGameNumber = persistenceKey
        ? Number(window.localStorage.getItem(persistenceKey))
        : Number.NaN
      const persistedIdx = gameNumbers.indexOf(persistedGameNumber)
      const activeIdx = activeGameNumber == null ? -1 : gameNumbers.indexOf(activeGameNumber)
      setIndex(persistedIdx >= 0 ? persistedIdx : Math.max(0, activeIdx))
      initializedRef.current = true
      return
    }
    const activeIdx = activeGameNumber == null ? -1 : gameNumbers.indexOf(activeGameNumber)
    if (autoFollowActiveGame && activeIdx >= 0) setIndex(activeIdx)
  }, [activeGameNumber, autoFollowActiveGame, gameNumbers, persistenceKey])

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

  const current = gameNumbers[index] ?? gameNumbers[0]
  const atStart = index <= 0
  const atEnd = index >= gameNumbers.length - 1
  const nav: TvGameNav = {
    onPrev: () => {
      setIndex((i) => Math.max(0, i - 1))
    },
    onNext: () => {
      setIndex((i) => Math.min(gameNumbers.length - 1, i + 1))
    },
    atStart,
    atEnd,
  }

  useEffect(() => {
    if (current == null) return
    if (skipFirstPersistenceWriteRef.current) {
      skipFirstPersistenceWriteRef.current = false
      return
    }
    if (persistenceKey) window.localStorage.setItem(persistenceKey, String(current))
    onGameChange?.(current)
  }, [current, onGameChange, persistenceKey])

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
