import type { GameCardInputProps } from './types'
import { GameCardView } from './GameCardView'

export function GameCardMobile(props: GameCardInputProps) {
  return <GameCardView {...props} size="mobile" />
}
