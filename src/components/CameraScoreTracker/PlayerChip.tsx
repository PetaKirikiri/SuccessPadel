import type { CourtPlayer } from '../../lib/americanoSchedule'

/** One player's name + avatar in the score tracker team header. */
export function PlayerChip({ player }: { player?: CourtPlayer }) {
  if (!player) return null
  const name = (player.name || 'Player').split(' ')[0]
  const initial = name[0]?.toUpperCase() ?? '?'
  return (
    <div>
      <span>{name}</span>
      {player.avatarUrl ? (
        <img src={player.avatarUrl} alt="" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}
