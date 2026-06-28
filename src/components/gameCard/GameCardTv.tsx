import './gameCard.tv.css'
import type { GameCardInputProps } from './types'
import { GameCardView } from './GameCardView'

/** Big-screen TV layout (≥1536px) — 2×2 court grid inside carousel. */
export function GameCardTv(props: GameCardInputProps) {
  return <GameCardView {...props} size="tv" />
}
