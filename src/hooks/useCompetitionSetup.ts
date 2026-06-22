import { useCallback, useEffect, useState } from 'react'
import { enrichCompetitionRowsAvatars } from '../lib/competitionRosterAvatars'
import { supabase } from '../lib/supabaseClient'
import type { CompetitionRow } from './useCompetitions'

export function useCompetitionSetup() {
  const [rows, setRows] = useState<CompetitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('list_competitions_for_setup')

    if (rpcError) {
      console.error('useCompetitionSetup', rpcError.message)
      setError(rpcError.message)
      setRows([])
    } else {
      const listed = (data as CompetitionRow[]) ?? []
      try {
        setRows(await enrichCompetitionRowsAvatars(listed))
      } catch (enrichErr) {
        console.error('useCompetitionSetup enrich', enrichErr)
        setRows(listed)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { rows, loading, error, refresh }
}
