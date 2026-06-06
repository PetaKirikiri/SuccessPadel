import type { GameSession } from '../lib/types'
import { partnershipLabel, scoringLabel } from '../lib/sessionSettings'

type Props = { session: GameSession; rosterCount: number }

export function GameSettingsSummary({ session, rosterCount }: Props) {
  const chips = [
    partnershipLabel(session.partnership_mode),
    scoringLabel(session.scoring_preset),
    `${rosterCount} players`,
  ]
  if (session.margin_bonus_enabled && session.scoring_preset === 'standard') {
    chips.push('Margin +1')
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span key={c} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">
          {c}
        </span>
      ))}
    </div>
  )
}
