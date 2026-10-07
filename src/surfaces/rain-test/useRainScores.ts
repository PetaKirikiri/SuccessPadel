import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { RAIN_COMPETITION_ID, RAIN_DRAW_FINGERPRINT, loadFrozenRainDraw } from './frozenRainDraw'
import { rainScoreKey, rainStorageKey } from './rainScores'
import { RainScoreSync, type RainSyncView, type OnlineRainScore } from './rainScoreSync'

export function useRainScores() {
  const syncRef = useRef<RainScoreSync | null>(null)
  const [view, setView] = useState<RainSyncView>({ scores: {}, ready: false, status: 'Connecting to saved scores…', conflicts: [] })
  useEffect(() => {
    let mounted = true
    const engine = new RainScoreSync(localStorage, rainStorageKey(RAIN_COMPETITION_ID, loadFrozenRainDraw()), {
      async read() {
        const { data: draw, error: drawError } = await supabase.from('rain_mode_draws').select('fingerprint,active').eq('session_id', RAIN_COMPETITION_ID).abortSignal(AbortSignal.timeout(12000)).single()
        if (drawError) throw drawError
        if (!draw.active || draw.fingerprint !== RAIN_DRAW_FINGERPRINT) throw Object.assign(new Error('The online draw does not match the locked draw.'), { code: 'DRAW_MISMATCH' })
        const { data, error } = await supabase.from('rain_mode_scores').select('game_number,court_slot,team_a,team_b,revision').eq('session_id', RAIN_COMPETITION_ID).abortSignal(AbortSignal.timeout(12000))
        if (error) throw error
        return data as OnlineRainScore[]
      },
      async save(key, edit) {
        const [game, court] = key.split(':')
        const { data, error } = await supabase.rpc('save_rain_mode_score', {
          p_session_id: RAIN_COMPETITION_ID, p_fingerprint: RAIN_DRAW_FINGERPRINT,
          p_game_number: Number(game), p_court_slot: Number(court!.slice(-1)),
          p_team_a: edit.score.teamAPoints, p_team_b: edit.score.teamBPoints,
          p_expected_revision: edit.revision,
        }).abortSignal(AbortSignal.timeout(12000))
        if (error) throw error
        return data as OnlineRainScore
      },
    }, next => { if (mounted) setView(next) })
    syncRef.current = engine
    setView(engine.view())
    void engine.sync()
    const refresh = () => { void engine.sync() }
    const timer = window.setInterval(refresh, 5000)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    return () => { mounted = false; engine.stop(); window.clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh) }
  }, [])
  return {
    ...view,
    saveScore: async (game: number, court: string, teamA: number, teamB: number) => {
      if (!syncRef.current) throw new Error('Wait for scores to load.')
      syncRef.current.edit(rainScoreKey(game, court), { teamAPoints: teamA, teamBPoints: teamB })
    },
    retry: () => { void syncRef.current?.sync() },
    resolve: (key: string, local: boolean) => {
      try { syncRef.current?.resolve(key, local) } catch { setView(current => ({ ...current, status: 'Could not save that choice. Please keep this page open and try again.' })) }
    },
    onlineScore: (key: string) => syncRef.current?.onlineScore(key),
  }
}
