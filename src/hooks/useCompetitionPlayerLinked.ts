import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useCompetitionPlayerLinked(
  competitionId: string | null,
  userId: string | undefined,
) {
  const [linked, setLinked] = useState(false)
  const [checking, setChecking] = useState(Boolean(competitionId && userId))

  const checkLinked = useCallback(async () => {
    if (!competitionId || !userId) {
      setLinked(false)
      setChecking(false)
      return
    }

    setChecking(true)
    const { data } = await supabase
      .from('session_players')
      .select('id')
      .eq('session_id', competitionId)
      .eq('profile_id', userId)
      .limit(1)
      .maybeSingle()

    setLinked(Boolean(data))
    setChecking(false)
  }, [competitionId, userId])

  useEffect(() => {
    void checkLinked()
  }, [checkLinked])

  useEffect(() => {
    if (!competitionId || !userId) return
    const onFocus = () => void checkLinked()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [checkLinked, competitionId, userId])

  return { linked, checking }
}
