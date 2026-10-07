import { useEffect, useState } from 'react'
import { ArrowLeft, CloudRain, Armchair, Repeat2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GameCard } from '../../components/GameCard'
import type { GameCardSession } from '../../components/GameCard/types'
import { useTranslation } from '../../hooks/useTranslation'
import { PlayerAvatar } from '../../shared/ProfilePhoto/PlayerAvatar'
import type { RainRound } from './rainSchedule'
import { loadFrozenRainDraw, RAIN_COMPETITION_ID, RAIN_COURT_IDS } from './frozenRainDraw'
import { rainScoreKey } from './rainScores'
import { useRainScores } from './useRainScores'
import { rainStandings } from './rainStandings'
import { Leaderboard } from '../../components/leaderboard/Leaderboard'
import '../../layouts/rain-preview.layout.css'

const COMPETITION_ID = RAIN_COMPETITION_ID
const keepExpanded = () => {}

export default function RainModePreview() {
  const { t } = useTranslation()
  const [rounds, setRounds] = useState<RainRound[]>([])
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(0)
  const { scores, ready, status: saveStatus, saveScore, retry, conflicts, resolve, onlineScore } = useRainScores()

  useEffect(() => {
    try {
      const schedule = loadFrozenRainDraw()
      setRounds(schedule)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the saved draw. No replacement draw has been generated.')
    }
  }, [])

  const round = rounds[selected]
  const next = rounds[selected + 1]
  const previewSession: GameCardSession = {
    kind: 'preview', courtsForGame: [], courtIdByLabel: RAIN_COURT_IDS,
    gameRoundId: `rain-round-${selected + 1}`, scoringEnabled: ready,
    matchForCourt: (_roundId, courtId) => scores[rainScoreKey(selected + 1, courtId)] ?? { teamAPoints: 0, teamBPoints: 0 },
  }
  return (
    <main className="rain-preview">
      <header className="rain-preview__header">
        <Link className="rain-preview__back" to={`/competitions/${COMPETITION_ID}`} aria-label="Back to competition"><ArrowLeft /></Link>
        <CloudRain className="rain-preview__weather" aria-hidden="true" />
        <div className="rain-preview__title"><h1>Rain mode</h1><p>Wed 7 Oct · 18:15 start · 2 courts · 10-minute games · 1m 45s changeovers</p></div>
        <div className="rain-preview__rule"><Repeat2 aria-hidden="true" /><strong>Play 2 · Rest 1</strong></div>
      </header>
      {error ? <p className="rain-preview__notice" role="alert">{error}</p> : !round ? <p className="rain-preview__notice" role="status">Loading tonight’s players…</p> : <>
        <div className="rain-preview__board">
          <div className="rain-preview__play">
          <section className="rain-preview__courts" aria-label={`Game ${selected + 1}: eight players on court`}>
            <GameCard key={round.game.gameNumber} game={round.game} session={previewSession}
              displayTimeLabel={round.game.timeLabel} scoreUnit="games" finished={false}
              isLiveNow={false} isCurrentGame={false} countdownLabelText="" collapsed={false}
              onToggleCollapsed={keepExpanded} t={t}
              canEdit={ready} onCompetitionCourtGamesSaved={saveScore}
              tvNav={{ onPrev: () => setSelected(index => Math.max(0, index - 1)), onNext: () => setSelected(index => Math.min(rounds.length - 1, index + 1)), atStart: selected === 0, atEnd: selected === rounds.length - 1 }} />
          </section>
          <aside className="rain-preview__rest" aria-label="Players sitting out this game">
            <div className="rain-preview__rest-heading"><Armchair aria-hidden="true" /><div><h2>Sitting out</h2><p>Game {selected + 1} · {round.game.timeLabel}</p></div></div>
            <ul className="rain-preview__rest-players">
              {round.resting.map(player => <li key={player.rosterId}><PlayerAvatar displayName={player.name} avatarUrl={player.avatarUrl} imgClassName="rain-preview__avatar" /><strong>{player.name}</strong></li>)}
            </ul>
            <div className="rain-preview__return"><Repeat2 aria-hidden="true" /><span>{next ? <>Back on at <strong>{next.startsAt}</strong></> : <>Last round · Rotation complete</>}</span></div>
          </aside>
          </div>
          <aside className="rain-preview__leaderboard" aria-label="Rain mode leaderboard">
            <Leaderboard competitionFormat="singles" entries={rainStandings(rounds, scores)} compact embedded scoreUnit="games" headerTitle="Leaderboard" showAchievements={false} />
          </aside>
        </div>
        <nav className="rain-preview__rounds" aria-label="Preview each rain-mode game">
          {rounds.map((item, index) => <button key={item.game.gameNumber} type="button" aria-current={selected === index ? 'step' : undefined} onClick={() => setSelected(index)}><strong>Game {item.game.gameNumber}</strong><span>{item.startsAt}</span></button>)}
        </nav>
        {conflicts.map(key => {
          const online = onlineScore(key)
          const local = scores[key]!
          return <div className="rain-preview__conflict" role="alert" key={key}>
            <span>Game {key.split(':')[0]} · Court {key.endsWith('1') ? '3' : '4'}: online {online?.teamAPoints ?? '–'}–{online?.teamBPoints ?? '–'}, this device {local.teamAPoints}–{local.teamBPoints}</span>
            <button type="button" onClick={() => resolve(key, false)}>Use online score</button>
            <button type="button" onClick={() => resolve(key, true)}>Keep this device’s score</button>
          </div>
        })}
        <footer className="rain-preview__footer"><span>12 players · 9 rounds · 6 games each · Ends {rounds.at(-1)?.endsAt}</span><span role="status">{saveStatus}</span>{saveStatus !== 'All scores saved online' && <button type="button" onClick={retry}>Retry sync</button>}</footer>
      </>}
    </main>
  )
}
