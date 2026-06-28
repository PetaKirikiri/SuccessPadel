import type { GameCardInputProps } from './types'
import { GameCardView } from './GameCardView'

export function GameCardWeb(props: GameCardInputProps) {
  return <GameCardView {...props} size="web" />
}
