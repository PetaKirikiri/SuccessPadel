import { useEffect, useState } from 'react'
import { ArrowLeft, Armchair, Repeat2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { GameCard } from '../../components/GameCard'
import type { GameCardSession } from '../../components/GameCard/types'
import { useTranslation } from '../../hooks/useTranslation'
import { PlayerAvatar } from '../../shared/ProfilePhoto/PlayerAvatar'
import { rainCountdown } from './rainCountdown'
import { readRainViewedGame, saveRainViewedGame } from './rainViewedGame'
import { unpackRainDraw, rainReturnTime, type RainDrawRecord } from './rainDraw'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
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
  return record ? <RainBoard key={`${record.session_id}:${reload}`} record={record} refresh={() => setReload(n => n + 1)} />
    : <main className="rain-preview"><p className="rain-preview__notice" role="status">{error || 'Loading rain mode…'}</p>{error && <button type="button" onClick={() => setReload(n => n + 1)}>Retry</button>}</main>
}

function RainSettings({ record, refresh }: { record: RainDrawRecord; refresh: () => void }) {
  const { user, profile } = useAuth()
  const settings = record.draw.settings
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (!settings) return null
  const admin = Boolean(user?.id && profile?.id === user.id && profile.is_admin)
  return <details className="rain-preview__rest">
    <summary>Rain settings · {settings.roundCount} × {settings.gameMinutes} min · {settings.changeoverMinutes} min changeover</summary>
    <p>{record.draw.date} · {record.draw.courtLabels.join(' + ')} · {record.draw.players.length} players</p>
    <p>{settings.playersStayingPerCourt} stay on each court · Same court throughout · New partners · Maximum {settings.maxConsecutiveGames} consecutive games</p>
    {settings.finalFullSwap && <p>Final game: all eight resting players come on. Five games each.</p>}
    {admin ? <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setMessage('')
      const values = new FormData(event.currentTarget)
      try {
        const { error } = await supabase.rpc('update_rain_mode_timing', {
          p_session_id: record.session_id, p_fingerprint: record.fingerprint,
          p_start: String(values.get('start')), p_game_minutes: Number(values.get('game')),
          p_break_minutes: Number(values.get('break')),
        })
        if (error) throw error
        refresh()
      } catch (cause) { setMessage(cause instanceof Error ? cause.message : (cause as { message?: string }).message || 'Could not save timing.') }
      finally { setBusy(false) }
    }}>
      <label>First game <input name="start" type="time" defaultValue={settings.startTime} required disabled={busy} /></label>
      <label>Game minutes <input name="game" type="number" min="5" max="60" defaultValue={settings.gameMinutes} required disabled={busy} /></label>
      <label>Changeover minutes <input name="break" type="number" min="1" max="30" defaultValue={settings.changeoverMinutes} required disabled={busy} /></label>
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save timing'}</button>
      <p>Finish by {settings.cutoff}. Timing locks after the first score. Player assignments stay unchanged.</p>
      {message && <p role="alert">{message}</p>}
    </form> : <p>First game {settings.startTime} · Finish by {settings.cutoff}</p>}
  </details>
}

function RainBoard({ record, refresh }: { record: RainDrawRecord; refresh: () => void }) {
  const { t } = useTranslation()
  const [rounds] = useState(() => unpackRainDraw(record))
  const competitionId = record.session_id
  const courtIds = new Map(record.draw.courtLabels.map((label, index) => [label, record.draw.courtIds[index]!]))
  const [selected, setSelected] = useState(() => readRainViewedGame(competitionId, rounds.length))
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
      <RainSettings record={record} refresh={refresh} />
      {!round ? <p className="rain-preview__notice" role="status">Loading tonight’s players…</p> : <>
        <div className="rain-preview__board">
          <div className="rain-preview__play">
          <section className="rain-preview__courts" aria-label={`Game ${selected + 1}: eight players on court`}>
            <GameCard key={round.game.gameNumber} game={round.game} session={previewSession}
              displayTimeLabel={round.game.timeLabel} scoreUnit="games" finished={false}
              isLiveNow={timer?.live ?? false} isCurrentGame={timer?.live ?? false}
              countdown={timer?.value} countdownLabelText={timer?.label ?? ''} collapsed={false}
              onToggleCollapsed={keepExpanded} t={t}
              canEdit={ready} onCompetitionCourtGamesSaved={saveScore}
              tvNav={{ onPrev: () => setSelected(index => Math.max(0, index - 1)), onNext: () => setSelected(index => Math.min(rounds.length - 1, index + 1)), atStart: selected === 0, atEnd: selected === rounds.length - 1 }} />
          </section>
          <aside className="rain-preview__rest" aria-label="Players sitting out this game">
            <div className="rain-preview__rest-heading"><Armchair aria-hidden="true" /><div><h2>Sitting out</h2><p>Game {selected + 1} · {round.game.timeLabel}</p></div></div>
            <ul className="rain-preview__rest-players">
              {round.resting.map(player => <li key={player.rosterId}><PlayerAvatar displayName={player.name} avatarUrl={player.avatarUrl} imgClassName="rain-preview__avatar" /><strong>{player.name}<small> · {rainReturnTime(rounds, selected, player.rosterId!) ?? 'Finished'}</small></strong></li>)}
            </ul>
            <div className="rain-preview__return"><Repeat2 aria-hidden="true" /><span>{next ? <>Next game <strong>{next.startsAt}</strong> · Off: {round.game.courts.flatMap(c => [...c.teamAPlayers!, ...c.teamBPlayers!]).filter(p => next.resting.some(r => r.rosterId === p.rosterId)).map(p => p.name).join(', ')} · On: {round.resting.filter(p => !next.resting.some(r => r.rosterId === p.rosterId)).map(p => p.name).join(', ')}</> : <>Last round · Rotation complete</>}</span></div>
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
