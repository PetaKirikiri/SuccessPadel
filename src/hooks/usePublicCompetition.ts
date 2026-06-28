import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { enrichCompetitionPlayersAvatars } from '../lib/competitionRosterAvatars'
import { mergeShowdownIntoRounds } from '../lib/competitionRoundShowdown'
import type { LeaderboardEntry } from '../lib/leaderboardTypes'
import { normalizeLeaderboardEntries } from '../lib/leaderboardEntries'
import type { CompetitionPlayer, CompetitionSessionPair } from './useCompetitions'
import type { ClubCourt, CompetitionRound, CourtMatch } from './useCompetitionRun'
import type { GameSession } from '../lib/types'

type PublicCompetition = {
  session: GameSession
  roster: CompetitionPlayer[]
  session_pairs?: CompetitionSessionPair[]
  courts: ClubCourt[]
  rounds: CompetitionRound[]
  matches: CourtMatch[]
  leaderboard: LeaderboardEntry[]
}

type Options = {
  /** Poll interval in ms. Pass false to disable background refresh. */
  pollMs?: number | false
}

export function usePublicCompetition(sessionId: string | undefined, options?: Options) {
  const pollMs = options?.pollMs
  const [session, setSession] = useState<GameSession | null>(null)
  const [rounds, setRounds] = useState<CompetitionRound[]>([])
  const [courtMatches, setCourtMatches] = useState<CourtMatch[]>([])
  const [roster, setRoster] = useState<CompetitionPlayer[]>([])
  const [sessionPairs, setSessionPairs] = useState<CompetitionSessionPair[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [clubCourts, setClubCourts] = useState<ClubCourt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyMatchScore = useCallback((roundId: string, courtId: string, scoreSummary: string) => {
    const playedAt = new Date().toISOString()
    setCourtMatches((prev) => {
      const next = [...prev]
      const idx = next.findIndex(
        (m) => m.competition_round_id === roundId && m.court_id === courtId,
      )
      const row: CourtMatch = {
        competition_round_id: roundId,
        court_id: courtId,
        score_summary: scoreSummary,
        played_at: playedAt,
        match_players: [],
      }
      if (idx >= 0) next[idx] = row
      else next.push(row)
      return next
    })
  }, [])

  const refresh = useCallback(
    async (silent = false) => {
      if (!sessionId) return
      if (!silent) setLoading(true)
      const [{ data, error: err }, { data: pairsData, error: pairsErr }] = await Promise.all([
        supabase.rpc('get_public_competition', { p_session_id: sessionId }),
        supabase.rpc('get_public_competition_session_pairs', { p_session_id: sessionId }),
      ])
      if (err || pairsErr) {
        setError(err?.message ?? pairsErr?.message ?? 'Failed to load competition')
      } else if (!data) {
        setError('Not found')
      } else {
        const d = data as PublicCompetition
        setError(null)
        setSession(d.session)
        const enrichedRoster = await enrichCompetitionPlayersAvatars(d.roster ?? [])
        setRoster(enrichedRoster)
        setRounds(mergeShowdownIntoRounds(d.rounds ?? [], enrichedRoster))
        setSessionPairs((pairsData as CompetitionSessionPair[]) ?? d.session_pairs ?? [])
        setClubCourts(d.courts ?? [])
        setCourtMatches(d.matches ?? [])
        setLeaderboard(normalizeLeaderboardEntries(d.leaderboard ?? []))
      }
      if (!silent) setLoading(false)
    },
    [sessionId],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!sessionId || pollMs === false || !pollMs) return
    const poll = setInterval(() => void refresh(true), pollMs)
    return () => clearInterval(poll)
  }, [pollMs, sessionId, refresh])

  const activeRound = rounds.find((r) => r.status === 'active') ?? null

  return {
    session,
    rounds,
    activeRound,
    courtMatches,
    roster,
    sessionPairs,
    clubCourts,
    leaderboard,
    onRoster: false,
    loading,
    error,
    refresh,
    applyMatchScore,
  }
}
