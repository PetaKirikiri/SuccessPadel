import { useEffect, useState, type ReactNode } from 'react'
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
  persistenceKey?: string
  renderGame: (gameNumber: number, nav: TvGameNav) => ReactNode
  onGameChange?: (gameNumber: number) => void
  className?: string
  t: TranslateFn
}

export function TvGameCarousel({
  gameNumbers,
  activeGameNumber,
  persistenceKey,
  renderGame,
  onGameChange,
  className = '',
}: Props) {
  // Selection belongs to this viewer, not the live round or the refreshed list order.
  const [selection, setSelection] = useState<{ key: string | undefined; game: number } | null>(null)
  const selectedGame = selection?.key === persistenceKey ? selection?.game : undefined

  useEffect(() => {
    if (gameNumbers.length === 0 || selectedGame != null) return
    let saved = Number.NaN
    try {
      if (persistenceKey) saved = Number(window.sessionStorage.getItem(persistenceKey))
    } catch { /* Private browsing may disable storage; in-memory navigation still works. */ }
    const initial = gameNumbers.includes(saved) ? saved
      : activeGameNumber != null && gameNumbers.includes(activeGameNumber) ? activeGameNumber
      : gameNumbers[0]!
    setSelection({ key: persistenceKey, game: initial })
  }, [activeGameNumber, gameNumbers, persistenceKey, selectedGame])

  const index = selectedGame == null ? -1 : gameNumbers.indexOf(selectedGame)
  const nav: TvGameNav = {
    onPrev: () => {
      if (index > 0) setSelection({ key: persistenceKey, game: gameNumbers[index - 1]! })
    },
    onNext: () => {
      if (index >= 0 && index < gameNumbers.length - 1)
        setSelection({ key: persistenceKey, game: gameNumbers[index + 1]! })
    },
    atStart: index <= 0,
    atEnd: index < 0 || index >= gameNumbers.length - 1,
  }

  useEffect(() => {
    if (selectedGame == null) return
    try {
      if (persistenceKey) window.sessionStorage.setItem(persistenceKey, String(selectedGame))
    } catch { /* Persistence is optional; it must never interrupt the game card. */ }
    onGameChange?.(selectedGame)
  }, [selectedGame, onGameChange, persistenceKey])

  if (index < 0 || selectedGame == null) return null

  return (
    <div
      className={`tv-game-carousel play-game-carousel relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden${className ? ` ${className}` : ''}`}
    >
      {renderGame(selectedGame, nav)}
    </div>
  )
}
