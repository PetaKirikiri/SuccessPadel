import { useCallback, useEffect, useState } from 'react'
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
      setRows((data as CompetitionRow[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { rows, loading, error, refresh }
}
