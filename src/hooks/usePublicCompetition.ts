import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import { normalizeLeaderboardEntries } from '../lib/leaderboardEntries'
import type { CompetitionPlayer } from './useCompetitions'
import type { ClubCourt, CompetitionRound, CourtMatch } from './useCompetitionRun'
import type { GameSession } from '../lib/types'

type PublicCompetition = {
  session: GameSession
  roster: CompetitionPlayer[]
  courts: ClubCourt[]
  rounds: CompetitionRound[]
  matches: CourtMatch[]
  leaderboard: LeaderboardEntry[]
}

export function usePublicCompetition(sessionId: string | undefined) {
  const [session, setSession] = useState<GameSession | null>(null)
  const [rounds, setRounds] = useState<CompetitionRound[]>([])
  const [courtMatches, setCourtMatches] = useState<CourtMatch[]>([])
  const [roster, setRoster] = useState<CompetitionPlayer[]>([])
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

  const mergeCourtMatches = useCallback((prev: CourtMatch[], incoming: CourtMatch[]) => {
    const byKey = new Map(prev.map((m) => [`${m.competition_round_id}:${m.court_id}`, m]))
    for (const m of incoming) {
      const key = `${m.competition_round_id}:${m.court_id}`
      const old = byKey.get(key)
      const oldMs = old?.played_at ? Date.parse(old.played_at) : 0
      const newMs = m.played_at ? Date.parse(m.played_at) : 0
      if (!old || newMs >= oldMs) byKey.set(key, m)
    }
    return [...byKey.values()]
  }, [])

  const refresh = useCallback(
    async (silent = false) => {
      if (!sessionId) return
      if (!silent) setLoading(true)
      const { data, error: err } = await supabase.rpc('get_public_competition', {
        p_session_id: sessionId,
      })
      if (err) {
        setError(err.message)
      } else if (!data) {
        setError('Not found')
      } else {
        const d = data as PublicCompetition
        setError(null)
        setSession(d.session)
        setRoster(d.roster ?? [])
        setClubCourts(d.courts ?? [])
        setRounds(d.rounds ?? [])
        setCourtMatches((prev) => mergeCourtMatches(prev, d.matches ?? []))
        setLeaderboard(normalizeLeaderboardEntries(d.leaderboard ?? []))
      }
      if (!silent) setLoading(false)
    },
    [mergeCourtMatches, sessionId],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!sessionId) return
    const poll = setInterval(() => void refresh(true), 2500)
    return () => clearInterval(poll)
  }, [sessionId, refresh])

  const activeRound = rounds.find((r) => r.status === 'active') ?? null

  return {
    session,
    rounds,
    activeRound,
    courtMatches,
    roster,
    clubCourts,
    leaderboard,
    onRoster: false,
    loading,
    error,
    refresh,
    applyMatchScore,
  }
}
