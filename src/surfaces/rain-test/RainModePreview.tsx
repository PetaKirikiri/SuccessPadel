import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { GameCard } from '../../components/GameCard'
import type { GameCardSession } from '../../components/GameCard/types'
import { useTranslation } from '../../hooks/useTranslation'
import { rainCountdown } from './rainCountdown'
import { currentRainGame, readRainViewedGame, saveRainViewedGame } from './rainViewedGame'
import { unpackRainDraw, type RainDrawRecord } from './rainDraw'
import { supabase } from '../../lib/supabaseClient'
import { rainScoreKey } from './rainScores'
import { useRainScores } from './useRainScores'
import { rainStandings } from './rainStandings'
import { Leaderboard } from '../../components/leaderboard/Leaderboard'
import '../../layouts/rain-preview.layout.css'

const keepExpanded = () => {}

export default function RainModePreview() {
  const [params] = useSearchParams()
  const competition = params.get('competition')
  const [record, setRecord] = useState<RainDrawRecord | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let mounted = true
    setRecord(null); setError('')
    let query = supabase.from('rain_mode_draws').select('session_id,fingerprint,active,draw')
    query = competition ? query.eq('session_id', competition) : query.eq('active', true).order('created_at', { ascending: false }).limit(1)
    void query.abortSignal(AbortSignal.timeout(12000)).single().then(({ data, error: cause }) => {
      if (!mounted) return
      try {
        if (cause) throw cause
        unpackRainDraw(data as RainDrawRecord)
        setRecord(data as RainDrawRecord)
      } catch { setError('Could not load the saved rain draw. No players or scores have been changed.') }
    })
    return () => { mounted = false }
  }, [competition, reload])
  return record ? <RainBoard key={`${record.session_id}:${reload}:${params.get('live')}`} record={record} openLatest={params.get('live') === '1'} />
    : <main className="rain-preview"><p className="rain-preview__notice" role="status">{error || 'Loading rain mode…'}</p>{error && <button type="button" onClick={() => setReload(n => n + 1)}>Retry</button>}</main>
}


function RainBoard({ record, openLatest }: { record: RainDrawRecord; openLatest: boolean }) {
  const { t } = useTranslation()
  const [rounds] = useState(() => unpackRainDraw(record))
  const competitionId = record.session_id
  const publicUrl = `https://successpadel.app/rain-mode?competition=${encodeURIComponent(competitionId)}&live=1`
  const courtIds = new Map(record.draw.courtLabels.map((label, index) => [label, record.draw.courtIds[index]!]))
  const [selected, setSelected] = useState(() => openLatest ? currentRainGame(record.draw.date, rounds) : readRainViewedGame(competitionId, rounds.length))
  const [clock, setClock] = useState(Date.now)
  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  const { scores, ready, status: saveStatus, saveScore, retry, conflicts, resolve, onlineScore } = useRainScores(record)

  const round = rounds[selected]
  useEffect(() => {
    if (round) saveRainViewedGame(competitionId, selected, rounds.length)
  }, [round, selected, rounds.length, competitionId])
  const next = rounds[selected + 1]
  const timer = round ? rainCountdown(record.draw.date, round.startsAt, round.endsAt, clock, next?.startsAt) : null
  const previewSession: GameCardSession = {
    kind: 'preview', courtsForGame: [], courtIdByLabel: courtIds,
    gameRoundId: `rain-round-${selected + 1}`, scoringEnabled: ready,
    matchForCourt: (_roundId, courtId) => scores[rainScoreKey(selected + 1, courtId)] ?? { teamAPoints: 0, teamBPoints: 0 },
  }
  return (
    <main className="rain-preview">
      <header className="rain-preview__header">
        <Link className="rain-preview__back" to={`/competitions/${competitionId}`} aria-label="Back to competition"><ArrowLeft /></Link>
        <img className="rain-preview__logo" src="/brand/logo-padel.webp" alt="Success Padel" />
        <div className="rain-preview__sky" aria-hidden="true">
          {[0, 1, 2].map(cloud => <svg key={cloud} className="rain-preview__cloud" viewBox="0 0 120 80" focusable="false">
            <path className="rain-preview__cloud-body" d="M24 44a14 14 0 0 1-1-28 22 22 0 0 1 42-5 17 17 0 0 1 28 14 10 10 0 0 1-1 20Z" />
            <g className="rain-preview__drops"><path d="m30 52-5 10m27-10-5 10m27-10-5 10m27-10-5 10" /></g>
            <g className="rain-preview__drops rain-preview__drops--second"><path d="m39 49-5 10m27-10-5 10m27-10-5 10" /></g>
          </svg>)}
        </div>
      </header>
      {!round ? <p className="rain-preview__notice" role="status">Loading tonight’s players…</p> : <>
        <div className="rain-preview__board">
          <div className="rain-preview__play">
          <section className="rain-preview__courts" aria-label={`Game ${selected + 1}: eight players on court`}>
            <GameCard key={round.game.gameNumber} game={round.game} session={previewSession}
              viewAlongUrl={publicUrl}
              displayTimeLabel={round.game.timeLabel} scoreUnit="games" finished={false}
              isLiveNow={timer?.live ?? false} isCurrentGame={timer?.live ?? false}
              countdown={timer?.value} countdownLabelText={timer?.label ?? ''} collapsed={false}
              onToggleCollapsed={keepExpanded} t={t}
              canEdit={ready} onCompetitionCourtGamesSaved={saveScore}
              tvNav={{ onPrev: () => setSelected(index => Math.max(0, index - 1)), onNext: () => setSelected(index => Math.min(rounds.length - 1, index + 1)), atStart: selected === 0, atEnd: selected === rounds.length - 1 }} />
          </section>
          {next && <aside className="rain-preview__rest" aria-label={`Next game ${next.game.gameNumber}`}>
            <div className="rain-preview__rest-heading"><div><h2>Next · {next.startsAt}</h2></div></div>
            <div className="rain-preview__next-courts">
              {next.game.courts.map(court => <table className="rain-preview__next-table" key={court.courtLabel}>
                <caption>{court.courtLabel}</caption>
                <tbody>
                  <tr><td><strong>{court.teamA[0]} + {court.teamA[1]}</strong></td></tr>
                  <tr className="rain-preview__next-versus"><td>vs</td></tr>
                  <tr><td><strong>{court.teamB[0]} + {court.teamB[1]}</strong></td></tr>
                </tbody>
              </table>)}
            </div>
          </aside>}
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
            <span>Game {key.split(':')[0]} · {record.draw.courtLabels[key.endsWith('1') ? 0 : 1]}: online {online?.teamAPoints ?? '–'}–{online?.teamBPoints ?? '–'}, this device {local.teamAPoints}–{local.teamBPoints}</span>
            <button type="button" onClick={() => resolve(key, false)}>Use online score</button>
            <button type="button" onClick={() => resolve(key, true)}>Keep this device’s score</button>
          </div>
        })}
        <footer className="rain-preview__footer"><span>{record.draw.players.length} players · {rounds.length} rounds · Ends {rounds.at(-1)?.endsAt}</span><span role="status">{saveStatus}</span>{saveStatus !== 'All scores saved online' && <button type="button" onClick={retry}>Retry sync</button>}</footer>
      </>}
    </main>
  )
}
