import type { GameCardInputProps } from './types'
import { GameCardView } from './GameCardView'

export function GameCardTablet(props: GameCardInputProps) {
  return <GameCardView {...props} size="tablet" />
}
