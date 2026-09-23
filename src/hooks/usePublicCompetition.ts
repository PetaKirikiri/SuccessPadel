import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useAuth } from './useAuth'
import { createNavigationSnapshotCache } from '../lib/navigationSnapshotCache'
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

const snapshots = createNavigationSnapshotCache<PublicCompetition>()
const emptyRounds: CompetitionRound[] = []
const emptyMatches: CourtMatch[] = []
const emptyRoster: CompetitionPlayer[] = []
const emptyPairs: CompetitionSessionPair[] = []
const emptyCourts: ClubCourt[] = []
const emptyLeaderboard: LeaderboardEntry[] = []

function normalizeCompetition(d: PublicCompetition, roster: CompetitionPlayer[]): PublicCompetition {
  return {
    ...d,
    roster,
    rounds: mergeShowdownIntoRounds(d.rounds ?? [], roster),
    matches: d.matches ?? [],
    courts: d.courts ?? [],
    session_pairs: d.session_pairs ?? [],
    leaderboard: normalizeLeaderboardEntries((d.leaderboard ?? []).map(entry => {
      const slot = roster.find(player => player.id === entry.profile_id ||
        (player.profile_id && [entry.profile_id, entry.member_profile_id].includes(player.profile_id)) ||
        (player.padel_player_id && [entry.profile_id, entry.padel_player_id].includes(player.padel_player_id)))
      return { ...entry, roster_entry_id: entry.roster_entry_id ?? slot?.id ?? null }
    })),
  }
}

export function usePublicCompetition(sessionId: string | undefined, options?: Options) {
  const pollMs = options?.pollMs
  const { user } = useAuth()
  const key = `${user?.id ?? 'public'}:${sessionId ?? ''}`
  const subscribe = useCallback((listener: () => void) => snapshots.subscribe(key, listener), [key])
  const read = useCallback(() => snapshots.read(key), [key])
  const snapshot = useSyncExternalStore(subscribe, read)
  const session = snapshot.data?.session ?? null
  const rounds = snapshot.data?.rounds ?? emptyRounds
  const courtMatches = snapshot.data?.matches ?? emptyMatches
  const roster = snapshot.data?.roster ?? emptyRoster
  const sessionPairs = snapshot.data?.session_pairs ?? emptyPairs
  const clubCourts = snapshot.data?.courts ?? emptyCourts
  const leaderboard = snapshot.data?.leaderboard ?? emptyLeaderboard
  const error = snapshot.error
  const loading = Boolean(sessionId) && !snapshot.data && !error

  const applyMatchScore = useCallback((roundId: string, courtId: string, scoreSummary: string) => {
    snapshots.update(key, current => {
      if (!current) return current
      const matches = [...current.matches]
      const idx = matches.findIndex(m => m.competition_round_id === roundId && m.court_id === courtId)
      const row: CourtMatch = { competition_round_id: roundId, court_id: courtId, score_summary: scoreSummary,
        played_at: new Date().toISOString(), match_players: [] }
      if (idx >= 0) matches[idx] = row
      else matches.push(row)
      return { ...current, matches }
    })
  }, [key])

  const refresh = useCallback(async (_silent = false) => {
    if (!sessionId) return
    await snapshots.refresh(key, async () => {
      const [{ data, error: err }, { data: pairsData, error: pairsErr }] = await Promise.all([
        supabase.rpc('get_public_competition', { p_session_id: sessionId }),
        supabase.rpc('get_public_competition_session_pairs', { p_session_id: sessionId }),
      ])
      if (err || pairsErr) throw new Error(err?.message ?? pairsErr?.message ?? 'Failed to load competition')
      if (!data) throw new Error('Not found')
      const d = data as PublicCompetition
      return normalizeCompetition({ ...d, session_pairs: (pairsData as CompetitionSessionPair[]) ?? d.session_pairs }, d.roster ?? [])
    })
    const current = snapshots.read(key).data
    if (!current) return
    // Photos enhance the already visible board; never hold navigation behind them.
    void enrichCompetitionPlayersAvatars(current.roster).then(enrichedRoster => {
      snapshots.update(key, latest => latest === current ? normalizeCompetition(current, enrichedRoster) : latest, false)
    }).catch(() => { /* Keep the board and its existing photos on enrichment failure. */ })
  }, [sessionId, key])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!sessionId || pollMs === false || !pollMs) return
    const poll = setInterval(() => void refresh(true), pollMs)
    return () => clearInterval(poll)
  }, [pollMs, sessionId, refresh])

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`public-competition-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'competition_rounds',
          filter: `session_id=eq.${sessionId}`,
        },
        () => void refresh(true),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `session_id=eq.${sessionId}`,
        },
        () => void refresh(true),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`,
        },
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
