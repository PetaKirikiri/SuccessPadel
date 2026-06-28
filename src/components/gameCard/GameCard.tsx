import { useGameCardSize } from '../../hooks/useGameCardSize'
import { GameCardMobile } from './GameCardMobile'
import { GameCardTablet } from './GameCardTablet'
import { GameCardTv } from './GameCardTv'
import { GameCardWeb } from './GameCardWeb'
import type { GameCardInputProps } from './types'

/** Single game card entry — routes to the size-specific component. */
export function GameCard(props: GameCardInputProps) {
  const detected = useGameCardSize()
  const size = props.size ?? detected

  switch (size) {
    case 'tv':
      return <GameCardTv {...props} />
    case 'tablet':
      return <GameCardTablet {...props} />
    case 'web':
      return <GameCardWeb {...props} />
    default:
      return <GameCardMobile {...props} />
  }
}
