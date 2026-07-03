import { useCallback, useEffect, useState } from 'react'
import {
  enrichCompetitionRowsAvatars,
  competitionPlayerAvatarUrl,
} from '../lib/competitionRosterAvatars'
import { createHubListCache } from '../lib/hubListCache'
import { supabase } from '../lib/supabaseClient'
import type { CompetitionRow } from './useCompetitions'

const cache = createHubListCache<CompetitionRow[]>()
let guestRosterLinkDone = false

function rosterNeedsAvatarEnrich(rows: CompetitionRow[]): boolean {
  for (const row of rows) {
    for (const sp of row.session_players ?? []) {
      if (sp.padel_player_id && !competitionPlayerAvatarUrl(sp)) return true
      if (sp.profile_id && !sp.profiles?.avatar_url) return true
    }
  }
  return false
}

async function loadCompetitionHubRows(): Promise<CompetitionRow[]> {
  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session && !guestRosterLinkDone) {
    guestRosterLinkDone = true
    await supabase.rpc('link_guest_rosters_by_email')
  }

  const { data, error: rpcError } = await supabase.rpc('list_competitions_for_setup')
  if (rpcError) throw new Error(rpcError.message)

  const listed = (data as CompetitionRow[]) ?? []
  if (!rosterNeedsAvatarEnrich(listed)) return listed

  try {
    return await enrichCompetitionRowsAvatars(listed)
  } catch {
    return listed
  }
}

export function clearCompetitionHubCache(): void {
  cache.clear()
  guestRosterLinkDone = false
}

export function useCompetitionHubRows(enabled = true) {
  const [rows, setRows] = useState<CompetitionRow[]>(() => cache.read()?.data ?? [])
  const [loading, setLoading] = useState(enabled && !cache.read())
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled) return
      if (!opts?.silent) setLoading(true)
      setError(null)
      try {
        cache.clear()
        const next = await cache.load(() => loadCompetitionHubRows(), { force: true })
        setRows(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load competitions')
        setRows([])
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [enabled],
  )

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const cached = cache.read()
    if (cached) {
      setRows(cached.data)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const next = await cache.load(() => loadCompetitionHubRows())
        if (cancelled) return
        setRows(next)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load competitions')
        setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { rows, loading, error, refresh }
}
