import { Coffee, Flag, Timer, UsersRound, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePublicCompetition } from '../../hooks/usePublicCompetition'
import { useCompetitionBoard } from '../../hooks/useCompetitionBoard'
import { formatGameTimeLabel, pivotScheduleByGame } from '../../lib/competitionCourtBoard'
import { competitionScheduleFromSession } from '../../lib/competitionScheduleLayout'
import './guide.css'

export const eventId = '9a06edcd-fb79-4cb2-9ddc-0aa0360e2003'

export default function OpenDuoGuide() {
  const { session, roster, sessionPairs, rounds, clubCourts, courtMatches, leaderboard, loading, error } = usePublicCompetition(eventId)
  const board = useCompetitionBoard(session, rounds, roster, clubCourts, courtMatches, sessionPairs, leaderboard)
  const games = pivotScheduleByGame(board.columns)
  const timing = competitionScheduleFromSession(session)
  return <main className="duo-guide" data-scroll-y>
    <header className="duo-guide-hero">
      <div><Link to="/c/9a06edcd">← Competition</Link><p>SUCCESS PADEL · FRIDAY 6 NOVEMBER</p>
      <h1>Open Duo Americano</h1><strong>Intermediate · Fixed pairs · Any pairing</strong></div>
      <img src="/brand/superhero-americano-duo.png" alt="" />
    </header>
    {error ? <p role="alert">{String(error)}</p> : !session || loading && !games.length ? <p role="status">Loading tonight’s draw…</p> : <>
      <section className="duo-guide-rules" aria-label="Match rules">
        <div><UsersRound/><strong>Fixed partners</strong><span>Play every other pair once.</span></div>
        <div><Timer/><strong>{games.length} × {timing.gameMinutes} min</strong><span>Play until the timer ends.</span></div>
        <div><Coffee/><strong>{timing.breakMinutes} min</strong><span>Break between rounds.</span></div>
        <div><Flag/><strong>First to {board.playTo}</strong><span>Games per match.</span></div>
        <div><Zap/><strong>40–40</strong><span>Golden point decides the game.</span></div>
      </section>
      <h2>Court lineup</h2>
      {games.length === 0 && <p>The draw is pending.</p>}
      {games.map(game => {
        const live = rounds.find(r => r.round_number === game.gameNumber)
        const time = live?.starts_at && live.ends_at ? formatGameTimeLabel(Date.parse(live.starts_at), Date.parse(live.ends_at)) : game.timeLabel
        return <section className="duo-guide-round" key={game.gameNumber}>
          <header><h3>Round {game.gameNumber}</h3><strong>{time}</strong></header>
          <div className="duo-guide-courts">{game.courts.map(court => <article key={court.courtLabel}>
            <h4>{court.courtLabel}</h4><strong>{court.teamA.join(' & ')}</strong><small>vs</small><strong>{court.teamB.join(' & ')}</strong>
          </article>)}</div>
        </section>
      })}
      <footer>Arrive 17:50 · 400 THB per player · Winners get their next tournament free.</footer>
    </>}
  </main>
}
