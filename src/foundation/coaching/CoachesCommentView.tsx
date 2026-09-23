import { ArrowLeft, ChevronLeft, ChevronRight, Check, Mic } from 'lucide-react'
import { CoachRecorder } from '../profile/CoachRecorder'
import type { CoachCourt, CoachPlayer } from '../../lib/coachGameLineup'
import '../../layouts/coach-feedback.layout.css'

type Props = {
  competitionId: string
  title: string
  gameNumber: number | null
  playerCount: number
  courts: CoachCourt[]
  unassigned: CoachPlayer[]
  saved: ReadonlySet<string>
  onSaved: (playerId: string) => void
  onBack: () => void
  onPrevious?: () => void
  onNext?: () => void
}
export function CoachesCommentView(props: Props) {
  function playerRow(player: CoachPlayer) {
    return <li key={player.id} className="coaches-comment__player">
      <div className="coaches-comment__identity"><strong>{player.name}</strong>
        {props.saved.has(player.id) ? <span role="status"><Check aria-hidden="true" />Comment saved</span> : null}
        {!player.playerId ? <span>Player profile needed to save a comment</span> : null}
      </div>
      {player.playerId ? <CoachRecorder playerId={player.playerId} playerName={player.name}
        competitionId={props.competitionId} compact onSaved={() => props.onSaved(player.id)} /> :
        <button className="coach-record-trigger" type="button" disabled aria-label={`Player profile needed for ${player.name}`}><Mic aria-hidden="true" /></button>}
    </li>
  }
  return <section className="coaches-comment">
    <header className="coaches-comment__header">
      <button type="button" onClick={props.onBack} aria-label="Back"><ArrowLeft aria-hidden="true" /></button>
      <div><h1>Coaches Comment</h1><p>{props.title}</p></div>
    </header>
    <nav className="coaches-comment__games" aria-label="Choose game">
      <button type="button" aria-label="Previous game" disabled={!props.onPrevious} onClick={props.onPrevious}><ChevronLeft aria-hidden="true" /></button>
      <div><strong>{props.gameNumber ? `Game ${props.gameNumber}` : 'Players'}</strong><span>{props.playerCount} players</span></div>
      <button type="button" aria-label="Next game" disabled={!props.onNext} onClick={props.onNext}><ChevronRight aria-hidden="true" /></button>
    </nav>
    <div className="coaches-comment__courts">
      {props.courts.map(court => <section key={court.id} className="coaches-comment__court" aria-label={court.name}>
        <h2>{court.name}</h2>
        {(['a', 'b'] as const).map(team => <section key={team} className="coaches-comment__team" data-team={team} aria-label={`Team ${team.toUpperCase()}`}>
          <h3>Team {team.toUpperCase()}</h3>
          <ul>{court[team].map(playerRow)}</ul>
        </section>)}
      </section>)}
      {props.unassigned.length ? <section className="coaches-comment__court"><h2>Not assigned to a court</h2><ul>{props.unassigned.map(playerRow)}</ul></section> : null}
      {!props.playerCount ? <p>No players have joined this competition yet.</p> : null}
    </div>
  </section>
}
