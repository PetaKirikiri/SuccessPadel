import { useEffect, useState } from 'react'
import {
  buildCourtRefsLookup,
  emptyCourtRefsLookup,
  parseSetupCourtsRpc,
  type CourtRefsLookup,
} from '../lib/courtRefs'
import { supabase } from '../lib/supabaseClient'

export function useSetupCourts() {
  const [courtNames, setCourtNames] = useState<string[]>([])
  const [courtRefs, setCourtRefs] = useState<CourtRefsLookup>(emptyCourtRefsLookup)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('list_setup_courts')
      if (!active) return
      const rows = parseSetupCourtsRpc(data)
      setCourtNames(rows.sort((a, b) => a.sort_order - b.sort_order).map((c) => c.name))
      setCourtRefs(buildCourtRefsLookup(rows))
    })()
    return () => {
      active = false
    }
  }, [])

  return { courtNames, courtRefs }
}
