import type { RuleChip } from '../../lib/friendlyGameDisplay'
import { RuleChipGrid } from '../../shared/Button/RuleChipGrid'

type InviteCardHeaderBadgesProps = {
  chips: RuleChip[]
}

const HEADER_BADGE_ORDER = ['format', 'rounds', 'gameMin', 'break', 'partners', 'scoring']
const HEADER_BADGE_EXCLUDED = new Set(['time', 'level', 'gender'])

function headerBadgeRank(chip: RuleChip): number {
  const index = HEADER_BADGE_ORDER.indexOf(chip.key)
  return index === -1 ? HEADER_BADGE_ORDER.length : index
}

export function InviteCardHeaderBadges({ chips }: InviteCardHeaderBadgesProps) {
  const headerChips = chips
    .filter((chip) => !HEADER_BADGE_EXCLUDED.has(chip.key))
    .sort((a, b) => headerBadgeRank(a) - headerBadgeRank(b))

  if (headerChips.length === 0) return null

  return (
    <div
      className="invite-game-card__badges"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <RuleChipGrid chips={headerChips} compact showLabels />
    </div>
  )
}
