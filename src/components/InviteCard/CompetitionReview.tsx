import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowUpRight, Check, CircleMinus, ClipboardCheck, MapPin, MessageSquare, Scale, Swords, Target, Trophy, Users, X } from 'lucide-react'
import { usePublicCompetition } from '../../hooks/usePublicCompetition'
import { rosterDisplayName } from '../../hooks/useCompetitions'
import { buildCompetitionReview, competitionReviewAvailable, reviewPlayerSummary, reviewRosterIdsForEntry } from '../../lib/competitionReview'
import { americanoScoringUnit } from '../../lib/competitionPresets'
import { playerProfilePath } from '../../lib/playerProfileSlug'
import { loadCoachEntries, type CoachEntry } from '../../lib/coachFeedback'
import { observationRating } from '../../lib/coachSkillRatings'
import { Leaderboard } from '../leaderboard/Leaderboard'
import { useViewportBucket } from '../../contexts/ViewportContext'
import { PlayerAvatar } from '../../shared/ProfilePhoto/PlayerAvatar'
import { competitionReviewUrl } from '../../lib/competitionReviewLink'
import type { LeaderboardEntry } from '../../lib/leaderboardTypes'
import { CompetitionReviewQr } from './CompetitionReviewQr'
import { CompetitionReviewPlayerTiles } from './CompetitionReviewPlayerTiles'
import '../../layouts/competition-review/review.mobile.css'
import '../../layouts/competition-review/review.tablet.css'
import '../../layouts/competition-review/review.web.css'
import '../../layouts/competition-review/review.tv.css'

export function CompetitionReview({ competitionId, userId }: { competitionId: string; userId?: string | null }) {
  const { session, roster, rounds, courtMatches, clubCourts, sessionPairs, loading, error, refresh } = usePublicCompetition(competitionId, { pollMs: false })
  const [searchParams, setSearchParams] = useSearchParams()
  const chosen = searchParams.get('player') ?? ''
  const isHero = useViewportBucket() === 'tv'
  const setChosen = (id: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous)
    next.set('competition', competitionId); next.set('view', 'review'); next.set('player', id)
    return next
  }, { replace: true })
  const selectId = useId()
  const personalRef = useRef<HTMLElement>(null)
  const model = useMemo(() => session ? buildCompetitionReview(session, roster, rounds, courtMatches, clubCourts, sessionPairs) : null,
    [session, roster, rounds, courtMatches, clubCourts, sessionPairs])
  const selected = roster.find(player => player.id === chosen) ?? roster.find(player => userId && player.profile_id === userId) ?? roster[0]
  const games = selected ? model?.byPlayer.get(selected.id) ?? [] : []
  const summary = reviewPlayerSummary(games)
  const [notes, setNotes] = useState<CoachEntry[]>([])
  const [notesError, setNotesError] = useState(false)
  const [notesLoading, setNotesLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const playerId = selected?.padel_player_id
  useEffect(() => {
    let active = true
    setNotes([]); setNotesError(false); setNotesLoading(Boolean(playerId))
    if (playerId) void loadCoachEntries(playerId, competitionId).then(rows => { if (active) setNotes(rows) })
      .catch(() => { if (active) setNotesError(true) }).finally(() => { if (active) setNotesLoading(false) })
    return () => { active = false }
  }, [playerId, competitionId, retry])
  if (loading) return <section className="competition-review" role="status">Loading review…</section>
  if (error || !session || !model) return <section className="competition-review" role="alert">Could not load the review. <button type="button" onClick={() => void refresh()}>Retry</button></section>
  if (!competitionReviewAvailable(session)) return <section className="competition-review">Review opens after the competition ends.</section>
  const unit = americanoScoringUnit(session)
  const unitLabel = unit === 'open' ? 'Score' : unit.charAt(0).toUpperCase() + unit.slice(1)
  const difference = summary.scored - summary.conceded
  const selectedEntryId = model.standings.entries.find(entry => selected && reviewRosterIdsForEntry(entry, roster).includes(selected.id))?.profile_id
  const selectEntry = (entry: LeaderboardEntry) => {
    const ids = reviewRosterIdsForEntry(entry, roster)
    const next = selected && ids.includes(selected.id) ? selected.id : ids[0]
    if (next) {
      setChosen(next)
      if (!isHero) personalRef.current?.scrollIntoView({ block: 'start' })
    }
  }
  const names = (ids: string[]) => ids.map(id => roster.find(player => player.id === id)).map(player => player ? rosterDisplayName(player) : 'Player').join(' & ')
  return <section className="competition-review" id={`review-${competitionId}`} aria-label="Competition review" onClick={event => event.stopPropagation()}>
    <header className="competition-review__heading"><h2><ClipboardCheck aria-hidden="true" /> Review</h2>
      {isHero && selected ? <div className="competition-review__identity"><PlayerAvatar displayName={rosterDisplayName(selected)} avatarUrl={selected.profiles?.avatar_url} imgClassName="competition-review__identity-avatar" /><strong>{rosterDisplayName(selected)}</strong></div> : null}
    </header>
    {model.recorded < model.expected ? <p role="status">Some results are still missing. These totals include recorded matches only.</p> : null}
    <div className="competition-review__columns">
      <section className="competition-review__personal" ref={personalRef}>
        {!isHero ? <label className="competition-review__picker" htmlFor={selectId}>Your night
          <select id={selectId} value={selected?.id ?? ''} onChange={event => setChosen(event.target.value)}>
            {roster.map(player => <option key={player.id} value={player.id}>{rosterDisplayName(player)}</option>)}
          </select>
        </label> : null}
        <dl className="competition-review__stats">
          <div className="competition-review__stat competition-review__stat--played">
            <dt><Activity aria-hidden="true" /> Matches played</dt>
            <dd>{summary.played}<span className="competition-review__stat-caption">recorded tonight</span></dd>
          </div>
          <div className="competition-review__stat competition-review__stat--record">
            <dt><Trophy aria-hidden="true" /> Match results</dt>
            <dd className="competition-review__record">
              <span data-result="Win"><Check aria-hidden="true" /><b>{summary.wins}</b><small>Won</small></span>
              <span data-result="Loss"><X aria-hidden="true" /><b>{summary.losses}</b><small>Lost</small></span>
              <span data-result="Draw"><CircleMinus aria-hidden="true" /><b>{summary.draws}</b><small>Drawn</small></span>
            </dd>
          </div>
          <div className="competition-review__stat competition-review__stat--score">
            <dt><Target aria-hidden="true" /> {unitLabel} scored</dt>
            <dd>{summary.scored}<span className="competition-review__stat-caption">toward your standing</span></dd>
            <p className="competition-review__difference" data-result={difference > 0 ? 'Win' : difference < 0 ? 'Loss' : 'Draw'}>
              {difference > 0 ? <ArrowUpRight aria-hidden="true" /> : difference < 0 ? <ArrowDownRight aria-hidden="true" /> : <Scale aria-hidden="true" />}
              {summary.conceded} conceded · {difference > 0 ? '+' : ''}{difference} net
            </p>
          </div>
        </dl>
        {summary.closest ? <div className="competition-review__closest"><Scale aria-hidden="true" />
          <div><strong>Closest match</strong><span>Game {summary.closest.round} · {summary.closest.scoreFor === summary.closest.scoreAgainst ? 'Finished level' : `Just ${Math.abs(summary.closest.scoreFor - summary.closest.scoreAgainst)} ${unit === 'open' ? 'between the teams' : `${unit.replace(/s$/, '')}${Math.abs(summary.closest.scoreFor - summary.closest.scoreAgainst) === 1 ? '' : 's'} apart`}`}</span></div>
          <b>{summary.closest.scoreFor}–{summary.closest.scoreAgainst}</b>
        </div> : null}
        <h3 className="competition-review__match-heading"><Swords aria-hidden="true" /> Your matchups{isHero && games.length > 2 ? <span>2 of {games.length} matches · full story on your phone</span> : null}</h3>
        <ol className="competition-review__matches">
          {(isHero ? games.slice(0, 2) : games).map(game => <li key={game.key}>
            <header><span>Game {game.round}</span><span><MapPin aria-hidden="true" /> {game.court}</span></header>
            <div className="competition-review__match-body">
              <div className="competition-review__sides">
                <p><Users aria-hidden="true" /><span>Partner<strong>{names(game.partners)}</strong></span></p>
                <p><Swords aria-hidden="true" /><span>Opponents<strong>{names(game.opponents)}</strong></span></p>
              </div>
              <div className="competition-review__match-score" data-result={game.outcome}>
                <span>{game.outcome === 'Win' ? <Check aria-hidden="true" /> : game.outcome === 'Loss' ? <X aria-hidden="true" /> : <CircleMinus aria-hidden="true" />}{game.outcome}</span>
                <strong>{game.scoreFor}<small>–</small>{game.scoreAgainst}</strong>
              </div>
            </div>
          </li>)}
        </ol>
        {!games.length ? <p>No recorded matches for this player yet.</p> : null}
        <section className="competition-review__feedback"><h3><MessageSquare aria-hidden="true" /> Coach feedback</h3>
          {notesLoading ? <p role="status">Loading coach notes…</p> : notesError ? <p role="alert">Could not load coach notes. <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p> : notes.length ? (isHero ? notes.slice(0, 1) : notes).map(entry => <article key={entry.id}>
            <header><strong>{entry.coach?.display_name ?? 'Coach'}</strong><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleDateString()}</time></header>
            {(isHero ? entry.feedback.observations.slice(0, 1) : entry.feedback.observations).map((note, index) => <div key={index}><blockquote>“{note.observation}”</blockquote>
              {observationRating(note) !== null ? <p>{note.skill || note.category} · {note.rating}/10{note.rating_source === 'estimated' ? ' · AI estimate' : ''}</p> : null}
              {note.next_step ? <p>{note.next_step}</p> : null}</div>)}
            {!entry.feedback.observations.length ? <blockquote>“{entry.transcript}”</blockquote> : null}
          </article>) : <p>No coach notes linked to this competition yet.</p>}
          {selected && (selected.padel_player_id || selected.profile_id) ? <Link to={playerProfilePath({ id: selected.padel_player_id ?? selected.profile_id, competitionId })}>View full player profile</Link> : null}
        </section>
      </section>
      <section className="competition-review__results" aria-label="Recorded standings">
        <h3><Trophy aria-hidden="true" /> {model.standings.format === 'duos' ? 'Team results' : 'Player results'}</h3>
        <p className="competition-review__standings-caption">Ranked by total {unit === 'open' ? 'score' : unit} scored</p>
        {isHero ? <CompetitionReviewPlayerTiles standings={model.standings} selectedId={selectedEntryId} onSelect={selectEntry} unit={unit === 'open' ? 'score' : unit} /> : model.standings.error ? <p role="status">{model.standings.error}</p> : <Leaderboard competitionFormat={model.standings.format} entries={model.standings.entries} scoreUnit={unit} competitionId={competitionId} embedded showAchievements={false} simpleTeamRows={model.standings.format === 'duos'} selectedEntryId={selectedEntryId} onSelectEntry={selectEntry} />}
        {isHero && selected ? <CompetitionReviewQr url={competitionReviewUrl(competitionId, selected.id)} playerName={rosterDisplayName(selected)} /> : null}
      </section>
    </div>
  </section>
}
