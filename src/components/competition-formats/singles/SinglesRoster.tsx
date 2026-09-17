import { PlayerNameLink } from '../../../shared/ProfilePhoto/PlayerNameLink'
import type { SinglesRosterProps } from '../rosterContract'

/** UI/layout lock: singles roster appearance belongs to its four format CSS files. */
export function SinglesRoster({ players, drag, sessionId, busyPlayerId, disabled, onAttendance }: SinglesRosterProps) {
  return (
    <ol className="competition-pregame__roster" data-fixed-pairs={false} aria-label="Players" aria-busy={drag.saving}>
      {players.map((player, index) => (
        <li className={`competition-pregame__player competition-pregame__player--${player.status}`} key={player.id}
          data-lineup-player={player.id} data-lineup-session={sessionId} data-drop-target={drag.targetId === player.id}
          data-reorder-enabled={drag.enabled} data-dragging={drag.draggingId === player.id}
          tabIndex={drag.enabled ? 0 : undefined}
          aria-label={drag.enabled ? `${player.name}, position ${index + 1}. Drag this card or use arrow keys to reorder.` : undefined}
          onPointerDown={(event) => drag.pointerDown(event, index)} onPointerMove={drag.pointerMove}
          onPointerUp={drag.pointerUp} onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel}
          onDragStart={(event) => event.preventDefault()} onKeyDown={(event) => drag.keyDown(event, index)}>
          <span className="competition-pregame__rank">{index + 1}</span>
          {player.avatar ? <img className="competition-pregame__avatar" src={player.avatar} alt="" /> :
            <span className="competition-pregame__avatar competition-pregame__avatar--initial">{player.name.trim().charAt(0).toUpperCase() || 'P'}</span>}
          <PlayerNameLink displayName={player.name} profileId={player.profileId} padelPlayerId={player.padelPlayerId}
            competitionId={sessionId} className="competition-pregame__name" disabled={drag.saving || drag.draggingId !== null} />
          <div className="competition-pregame__attendance-actions" role="group" aria-label={`${player.name}: attendance`} aria-busy={busyPlayerId === player.id}>
            <button type="button" className="competition-pregame__attendance-yes" disabled={disabled}
              aria-pressed={player.status === 'confirmed'} aria-label={`${player.name}: confirm attendance`}
              onClick={() => onAttendance(player.id, player.status === 'confirmed' ? 'pending' : 'confirmed')}>Confirm</button>
            <button type="button" className="competition-pregame__attendance-no" disabled={disabled}
              aria-pressed={player.status === 'cancelled'} aria-label={`${player.name}: can’t play`}
              onClick={() => onAttendance(player.id, player.status === 'cancelled' ? 'pending' : 'cancelled')}>Can’t play</button>
          </div>
        </li>
      ))}
    </ol>
  )
}
