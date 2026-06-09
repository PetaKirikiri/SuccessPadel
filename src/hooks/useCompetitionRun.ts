import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { LeaderboardEntry } from '../components/CompetitionLeaderboard'
import { normalizeLeaderboardEntries } from '../lib/leaderboardEntries'
import type { CompetitionPlayer } from './useCompetitions'
import type { GameSession } from '../lib/types'

export type RoundPlayer = {
  court_id: string
  team: 'a' | 'b'
  roster_entry_id: string
  profile_id: string | null
  padel_player_id: string | null
  session_players: {
    guest_name: string | null
    profile_id: string | null
    padel_player_id: string | null
    profiles: {
      id: string
      display_name: string
      avatar_url?: string | null
      preferred_side?: string | null
    } | null
  } | null
  courts: { id: string; name: string } | null
}

export function roundPlayerName(p: RoundPlayer): string {
  return (
    p.session_players?.profiles?.display_name ??
    p.session_players?.guest_name ??
    'Player'
  )
}

export type CompetitionRound = {
  id: string
  session_id: string
  round_number: number
  is_final: boolean
  starts_at: string
  ends_at: string
  status: 'pending' | 'active' | 'complete'
  competition_round_players: RoundPlayer[]
}

export type CourtMatch = {
  competition_round_id: string
  court_id: string
  score_summary: string
  played_at?: string
  match_players: { team: 'a' | 'b'; is_winner: boolean }[]
}

export type ClubCourt = { id: string; name: string; sort_order: number }

export function matchWinnerTeam(m: CourtMatch): 'a' | 'b' | undefined {
  const w = m.match_players.find((p) => p.is_winner)
  return w?.team
}

export function useCompetitionRun(sessionId: string | undefined) {
  const [session, setSession] = useState<GameSession | null>(null)
  const [rounds, setRounds] = useState<CompetitionRound[]>([])
  const [courtMatches, setCourtMatches] = useState<CourtMatch[]>([])
  const [roster, setRoster] = useState<CompetitionPlayer[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [clubCourts, setClubCourts] = useState<ClubCourt[]>([])
  const [onRoster, setOnRoster] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async (silent = false) => {
    if (!sessionId) return
    if (!silent) setLoading(true)
    setError(null)

    const [sessionRes, roundsRes, matchesRes, rosterRes, leaderboardRes, courtsRes] =
      await Promise.all([
      supabase.from('game_sessions').select('*').eq('id', sessionId).single(),
      supabase
        .from('competition_rounds')
        .select(
          `*,
           competition_round_players(court_id, team, roster_entry_id, profile_id,
             session_players(guest_name, profile_id, profiles(id, display_name, avatar_url, preferred_side)),
             courts(id, name))`,
        )
        .eq('session_id', sessionId)
        .order('round_number'),
      supabase
        .from('matches')
        .select('competition_round_id, court_id, score_summary, match_players(team, is_winner)')
        .eq('session_id', sessionId)
        .not('competition_round_id', 'is', null),
      supabase
        .from('session_players')
        .select('id, profile_id, guest_name, guest_email, rank_order, profiles(id, display_name, avatar_url)')
        .eq('session_id', sessionId)
        .order('rank_order')
        .order('id'),
      supabase.rpc('get_competition_leaderboard', { p_session_id: sessionId }),
      supabase.from('courts').select('id, name, sort_order').eq('is_active', true).order('sort_order'),
    ])

    if (sessionRes.error) setError(sessionRes.error.message)
    else setSession((sessionRes.data as GameSession) ?? null)

    if (roundsRes.error) setError(roundsRes.error.message)
    else setRounds((roundsRes.data as CompetitionRound[]) ?? [])

    if (matchesRes.error) setError(matchesRes.error.message)
    else setCourtMatches((matchesRes.data as CourtMatch[]) ?? [])

    setRoster((rosterRes.data as unknown as CompetitionPlayer[]) ?? [])

    if (!leaderboardRes.error && leaderboardRes.data) {
      setLeaderboard(normalizeLeaderboardEntries(leaderboardRes.data as LeaderboardEntry[]))
    }

    if (!courtsRes.error && courtsRes.data) {
      setClubCourts(courtsRes.data as ClubCourt[])
    }

    const { data: authData } = await supabase.auth.getUser()
    const uid = authData.user?.id
    setOnRoster(Boolean(uid && rosterRes.data?.some((r) => r.profile_id === uid)))

    if (!silent) setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!sessionId) return
    const poll = setInterval(() => void refresh(true), 5000)
    return () => clearInterval(poll)
  }, [sessionId, refresh])

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`competition-run-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'competition_rounds', filter: `session_id=eq.${sessionId}` },
        () => void refresh(true),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `session_id=eq.${sessionId}` },
        () => void refresh(true),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
        () => void refresh(true),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
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
    onRoster,
    loading,
    error,
    refresh,
  }
}
