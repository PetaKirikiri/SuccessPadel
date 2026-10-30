import type { CompetitionPlayer } from '../hooks/useCompetitions'
import type { ClubCourt, CompetitionRound } from '../hooks/useCompetitionRun'
import type { GameSession } from './types'
import { competitionScheduleFromSession, sessionHasExplicitCompetitionSchedule } from './competitionScheduleLayout'
import { storedScheduleFromConfig } from './rankedSchedule'
import { validateCompetitionDraw } from './competitionOperations'

const clock = (iso: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(iso))

/** Presentation only: a linked announcement reads the same saved event as the scoreboard. */
export function halloweenSavedPlan(session: GameSession, roster: CompetitionPlayer[], rounds: CompetitionRound[], courts: ClubCourt[]) {
  const slot = (id: string) => {
    const index = roster.findIndex(p => p.id === id)
    if (index < 0) throw new Error('Saved draw contains a player missing from this lineup.')
    return index
  }
  const label = (id: string) => {
    const court = courts.find(c => c.id === id)
    if (!court) throw new Error('A saved court is unavailable.')
    return court.name
  }
  if (rounds.length) return [...rounds].sort((a,b) => a.round_number-b.round_number).map(r => {
    if (!r.starts_at || !r.ends_at || r.competition_round_players.length !== roster.length) throw new Error('The saved round is incomplete.')
    const courtIds = [...new Set(r.competition_round_players.map(p => p.court_id))]
    return { number:r.round_number, start:clock(r.starts_at), end:clock(r.ends_at), labels:courtIds.map(label),
      courts:courtIds.map(id => {
        const players = r.competition_round_players.filter(p => p.court_id === id)
        const a = players.filter(p => p.team === 'a'), b = players.filter(p => p.team === 'b')
        if (a.length !== 2 || b.length !== 2) throw new Error('The saved court is incomplete.')
        return [...a,...b].map(p => slot(p.roster_entry_id)) as [number,number,number,number]
      }) }
  })
  if (!sessionHasExplicitCompetitionSchedule(session) || !session.starts_at) throw new Error('Save the event timing before showing its matchups.')
  const timing = competitionScheduleFromSession(session), draw = storedScheduleFromConfig(session.scoring_config)
  validateCompetitionDraw(draw,roster.map(p => p.id),timing.games)
  const courtIds = session.scoring_config?.schedule_court_ids
  if (!courtIds || courtIds.length !== roster.length/4) throw new Error('Save the physical courts before showing the matchups.')
  return draw.map(r => {
    const start = Date.parse(session.starts_at!)+(r.round-1)*(timing.gameMinutes+timing.breakMinutes)*60000
    return { number:r.round, start:clock(new Date(start).toISOString()), end:clock(new Date(start+timing.gameMinutes*60000).toISOString()),
      labels:r.matches.map(m => label(courtIds[m.court-1])),
      courts:r.matches.map(m => [...m.team_a,...m.team_b].map(slot) as [number,number,number,number]) }
  })
}
