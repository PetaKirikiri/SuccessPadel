import { PlayerNameLink } from '../../../shared/ProfilePhoto/PlayerNameLink'
import type { DuosRosterProps } from '../rosterContract'

/** UI/layout lock: fixed-pair appearance belongs to its four format CSS files. */
export function DuosRoster({ teams, sessionId, busyPlayerId, disabled, onAttendance }: DuosRosterProps) {
  return (
    <ol className="competition-pregame__roster" data-fixed-pairs={true} aria-label="Fixed-pair teams" aria-busy={false}>
      {teams.flatMap((team, teamIndex) => team.map((player, side) => (
        <li className={`competition-pregame__player competition-pregame__player--${player.status}`} key={player.id}
          data-team-side={side === 0 ? 'first' : 'second'} data-team-number={teamIndex + 1}
          data-lineup-player={player.id} data-lineup-session={sessionId}
          data-drop-target={false} data-reorder-enabled={false} data-dragging={false}
          aria-label={`Team ${teamIndex + 1}: ${player.name}`} onDragStart={(event) => event.preventDefault()}>
          <span className="competition-pregame__rank">{teamIndex * 2 + side + 1}</span>
          {player.avatar ? <img className="competition-pregame__avatar" src={player.avatar} alt="" /> :
            <span className="competition-pregame__avatar competition-pregame__avatar--initial">{player.name.trim().charAt(0).toUpperCase() || 'P'}</span>}
          <PlayerNameLink displayName={player.name} profileId={player.profileId} padelPlayerId={player.padelPlayerId}
            competitionId={sessionId} className="competition-pregame__name" />
          <div className="competition-pregame__attendance-actions" role="group" aria-label={`${player.name}: attendance`} aria-busy={busyPlayerId === player.id}>
            <button type="button" className="competition-pregame__attendance-yes" disabled={disabled}
              aria-pressed={player.status === 'confirmed'} aria-label={`${player.name}: confirm attendance`}
              onClick={() => onAttendance(player.id, player.status === 'confirmed' ? 'pending' : 'confirmed')}>Confirm</button>
            <button type="button" className="competition-pregame__attendance-no" disabled={disabled}
              aria-pressed={player.status === 'cancelled'} aria-label={`${player.name}: can’t play`}
              onClick={() => onAttendance(player.id, player.status === 'cancelled' ? 'pending' : 'cancelled')}>Can’t play</button>
          </div>
        </li>
      )))}
    </ol>
  )
}
