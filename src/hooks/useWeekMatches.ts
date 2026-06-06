import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { GameSession, MatchWithPlayers, Profile, SessionPair } from '../lib/types'

export function useActiveSession(sessionId?: string | null) {
  const [session, setSession] = useState<GameSession | null>(null)
  const [roster, setRoster] = useState<Profile[]>([])
  const [pairs, setPairs] = useState<SessionPair[]>([])
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)

    let s: GameSession | null = null

    if (sessionId) {
      const { data } = await supabase.from('game_sessions').select('*').eq('id', sessionId).single()
      s = (data as GameSession) ?? null
    } else {
      const { data: sessions } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('status', 'open')
        .eq('game_kind', 'competition')
        .order('starts_on', { ascending: false })
        .limit(1)
      s = (sessions?.[0] as GameSession) ?? null
    }

    setSession(s)

    if (!s) {
      setRoster([])
      setPairs([])
      setMatches([])
      setLoading(false)
      return
    }

    if (s.game_kind === 'court') {
      const { data: slotRows } = await supabase
        .from('game_slots')
        .select('slot_players(profile_id, profiles(*))')
        .eq('session_id', s.id)

      const seen = new Set<string>()
      const rosterList: Profile[] = []
      for (const row of slotRows ?? []) {
        const slotPlayers = (row as unknown as {
          slot_players: { profile_id: string; profiles: Profile | null }[]
        }).slot_players
        for (const sp of slotPlayers) {
          if (!seen.has(sp.profile_id) && sp.profiles) {
            seen.add(sp.profile_id)
            rosterList.push(sp.profiles)
          }
        }
      }
      setRoster(rosterList)
      setPairs([])
    } else {
      const { data: players } = await supabase
        .from('session_players')
        .select('profile_id, profiles(*)')
        .eq('session_id', s.id)

      setRoster(
        (players ?? [])
          .map((p) => {
            const prof = p.profiles as Profile | Profile[] | null
            return Array.isArray(prof) ? prof[0] : prof
          })
          .filter((p): p is Profile => Boolean(p)),
      )

      const { data: pairRows } = await supabase.from('session_pairs').select('*').eq('session_id', s.id)
      setPairs((pairRows as SessionPair[]) ?? [])
    }

    const { data: matchRows } = await supabase
      .from('matches')
      .select(
        `id, session_id, played_at, score_summary, notes,
         match_players(profile_id, team, is_winner, points_earned, profiles(display_name))`,
      )
      .eq('session_id', s.id)
      .order('played_at', { ascending: false })

    setMatches((matchRows as unknown as MatchWithPlayers[]) ?? [])
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { session, roster, pairs, matches, loading, refresh }
}
