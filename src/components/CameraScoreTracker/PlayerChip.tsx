import type { CourtPlayer } from '../../lib/americanoSchedule'

/** One player's name + avatar in the score tracker team header. */
export function PlayerChip({ player }: { player?: CourtPlayer }) {
  if (!player) return null
  const name = (player.name || 'Player').split(' ')[0]
  const initial = name[0]?.toUpperCase() ?? '?'
  return (
    <div className="gesture-score-court__player-chip">
      <span className="gesture-score-court__player-name">{name}</span>
      {player.avatarUrl ? (
        <img className="gesture-score-court__player-avatar" src={player.avatarUrl} alt="" />
      ) : (
        <span className="gesture-score-court__player-avatar" aria-hidden>
          {initial}
        </span>
      )}
    </div>
  )
}
