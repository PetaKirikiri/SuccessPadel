import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { nearestCompetitionId, type HomepageCompetition } from '../lib/nearestCompetition'
import { supabase } from '../lib/supabaseClient'

export function HomeCompetitionRedirect() {
  const { search, hash } = useLocation()
  const [destination, setDestination] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 8000)
    void (async () => {
      let id: string | null = null
      try {
        const { data, error } = await supabase.rpc('list_competitions_for_setup').abortSignal(controller.signal)
        if (!error && Array.isArray(data)) id = nearestCompetitionId(data as HomepageCompetition[])
      } finally {
        window.clearTimeout(timer)
        if (!cancelled) {
          const params = new URLSearchParams(search)
          if (id && !params.has('competition')) params.set('competition', id)
          const query = params.toString()
          setDestination(`/competitive${query ? `?${query}` : ''}${hash}`)
        }
      }
    })().catch(() => { /* The finally block provides the competition-list fallback. */ })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search, hash])

  return destination ? <Navigate to={destination} replace /> : <p role="status">Loading competition…</p>
}
