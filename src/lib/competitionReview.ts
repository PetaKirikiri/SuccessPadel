import type { GameSession } from './types'
import type { CompetitionPlayer, CompetitionSessionPair } from '../hooks/useCompetitions'
import type { ClubCourt, CompetitionRound, CourtMatch } from '../hooks/useCompetitionRun'
import { computeAmericanoStandings } from './competitionStandings'
import { computeDuoStandings } from './computeDuoStandings'
import { isDuoCompetition } from './competitionFormatPresets'
import { fixedPairRoster } from './competition-formats/duos/roster'
import { duoStandings } from './competition-formats/duos/standings'
import { singlesStandings } from './competition-formats/singles/standings'
import type { LeaderboardEntry } from './leaderboardTypes'

/** Resolve Review selections by identity only, including explicit duo roster IDs. */
export function reviewRosterIdsForEntry(entry: LeaderboardEntry, roster: CompetitionPlayer[]): string[] {
  if (entry.profile_id.startsWith('duo:')) {
    return entry.profile_id.slice(4).split(':').filter(id => roster.some(player => player.id === id))
  }
  const player = roster.find(player => player.id === entry.roster_entry_id)
    ?? roster.find(player => entry.padel_player_id && player.padel_player_id === entry.padel_player_id)
    ?? roster.find(player => player.profile_id && player.profile_id === (entry.member_profile_id ?? entry.profile_id))
    ?? roster.find(player => player.id === entry.profile_id)
  return player ? [player.id] : []
}

export function competitionReviewAvailable(session: GameSession | null | undefined, now = Date.now()): boolean {
  if (!session) return false
  if (session.status === 'complete' || session.competition_concluded_at || session.competition_ended_at) return true
  return Boolean(session.competition_started_at && session.ends_at && Date.parse(session.ends_at) <= now)
}

export type ReviewMatch = {
  key: string; round: number; court: string; scoreFor: number; scoreAgainst: number
  partners: string[]; opponents: string[]; outcome: 'Win' | 'Draw' | 'Loss'
}

/** Read-only summary of persisted rounds and results. Never generates pairings. */
export function buildCompetitionReview(session: GameSession, roster: CompetitionPlayer[], rounds: CompetitionRound[], matches: CourtMatch[], courts: ClubCourt[], pairs: CompetitionSessionPair[]) {
  const byPlayer = new Map<string, ReviewMatch[]>(roster.map(player => [player.id, []]))
  const valid: CourtMatch[] = []
  let expected = 0
  for (const round of rounds) {
    const courtIds = new Set(round.competition_round_players.map(player => player.court_id))
    for (const courtId of courtIds) {
      const players = round.competition_round_players.filter(player => player.court_id === courtId)
      const a = players.filter(player => player.team === 'a').map(player => player.roster_entry_id)
      const b = players.filter(player => player.team === 'b').map(player => player.roster_entry_id)
      if (a.length !== 2 || b.length !== 2) continue // byes are not matches
      expected++
      if (new Set([...a, ...b]).size !== 4 || [...a, ...b].some(id => !byPlayer.has(id))) continue
      const candidates = matches.filter(match => match.competition_round_id === round.id && match.court_id === courtId)
      const parsed = candidates.map(match => {
        const parts = /^(\d+)\s*[-–]\s*(\d+)$/.exec(match.score_summary?.trim() ?? '')
        return parts ? [Number(parts[1]), Number(parts[2])] as const : null
      }).filter((score): score is readonly [number, number] => score !== null && score.every(Number.isSafeInteger))
      if (!parsed.length || parsed.some(score => score[0] !== parsed[0][0] || score[1] !== parsed[0][1])) continue
      const [scoreA, scoreB] = parsed[0]
      valid.push({ ...candidates[0], score_summary: `${scoreA}-${scoreB}` })
      for (const player of players) {
        const ours = player.team === 'a' ? a : b, theirs = player.team === 'a' ? b : a
        const scoreFor = player.team === 'a' ? scoreA : scoreB, scoreAgainst = player.team === 'a' ? scoreB : scoreA
        byPlayer.get(player.roster_entry_id)!.push({
          key: `${round.id}:${courtId}`, round: round.round_number,
          court: courts.find(court => court.id === courtId)?.name ?? player.courts?.name ?? 'Court',
          scoreFor, scoreAgainst, partners: ours.filter(id => id !== player.roster_entry_id), opponents: theirs,
          outcome: scoreFor > scoreAgainst ? 'Win' : scoreFor < scoreAgainst ? 'Loss' : 'Draw',
        })
      }
    }
  }
  for (const games of byPlayer.values()) games.sort((a, b) => a.round - b.round || a.court.localeCompare(b.court))
  const fixed = fixedPairRoster(roster, pairs)
  const standings = isDuoCompetition(session)
    ? duoStandings(fixed.error ? [] : computeDuoStandings(roster, rounds, valid, fixed.teams.map(([a, b], index) => ({
      label: pairs[index]?.pair_label ?? `Team ${index + 1}`, roster_ids: [a.id, b.id] as [string, string],
    }))), roster.length / 2)
    : singlesStandings(computeAmericanoStandings(roster, rounds, valid))
  return { byPlayer, standings, recorded: valid.length, expected }
}

export function reviewPlayerSummary(matches: ReviewMatch[]) {
  const wins = matches.filter(match => match.outcome === 'Win').length
  const draws = matches.filter(match => match.outcome === 'Draw').length
  return { played: matches.length, wins, draws, losses: matches.length - wins - draws,
    scored: matches.reduce((sum, match) => sum + match.scoreFor, 0),
    conceded: matches.reduce((sum, match) => sum + match.scoreAgainst, 0),
    closest: [...matches].sort((a, b) => Math.abs(a.scoreFor - a.scoreAgainst) - Math.abs(b.scoreFor - b.scoreAgainst))[0] ?? null,
  }
}
