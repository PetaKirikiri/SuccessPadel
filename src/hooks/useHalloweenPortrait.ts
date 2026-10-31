import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type Portrait = { roster_id: string; profile_id: string | null; player_id: string | null; portrait_url: string; revision: number }
type Entry = { rows: Portrait[]; listeners: Set<() => void>; loading: boolean; timer?: ReturnType<typeof setInterval> }
const cache = new Map<string, Entry>()
async function refresh(sessionRef: string, entry: Entry) {
  if (entry.loading) return
  entry.loading = true
  try {
    const { data, error } = await supabase.rpc('list_halloween_portraits', { p_session_ref: sessionRef })
    if (!error) { entry.rows = (data ?? []) as Portrait[]; entry.listeners.forEach(fn => fn()) }
  } catch {
    // Keep the ordinary photo when the portrait service is unavailable.
  } finally { entry.loading = false }
}
export function useHalloweenPortrait(profileId?: string | null, playerId?: string | null, rosterId?: string | null) {
  const { pathname } = useLocation()
  const sessionRef = pathname.match(/^\/(?:c|competitions)\/([a-f0-9-]{8,36})(?:\/|$)/i)?.[1]
  const [, setVersion] = useState(0)
  useEffect(() => {
    if (!sessionRef) return
    let entry = cache.get(sessionRef)
    if (!entry) { entry = { rows: [], listeners: new Set(), loading: false }; cache.set(sessionRef, entry) }
    const notify = () => setVersion(v => v + 1)
    entry.listeners.add(notify)
    if (!entry.timer) {
      void refresh(sessionRef, entry)
      entry.timer = setInterval(() => { void refresh(sessionRef, entry!) }, 30_000)
    }
    return () => {
      entry!.listeners.delete(notify)
      if (!entry!.listeners.size) { clearInterval(entry!.timer); entry!.timer = undefined }
    }
  }, [sessionRef])
  return (sessionRef ? cache.get(sessionRef)?.rows : undefined)?.find(p =>
    (rosterId && p.roster_id === rosterId) || (playerId && p.player_id === playerId) || (profileId && p.profile_id === profileId))?.portrait_url
}
