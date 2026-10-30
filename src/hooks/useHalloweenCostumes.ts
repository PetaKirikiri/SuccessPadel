import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { directoryOwnerToken } from '../lib/memberDirectoryAccess'
import { loadHalloweenCostumes, type HalloweenCostume } from '../lib/halloweenCostumes'

export function useHalloweenCostumes(sessionId: string, enabled: boolean, rosterVersion: string) {
  const location = useLocation()
  const { user, loading } = useAuth()
  const token = useMemo(() => {
    try { return directoryOwnerToken(location.hash, localStorage) ?? directoryOwnerToken(location.hash, sessionStorage) }
    catch { return null }
  }, [location.hash])
  const [records, setRecords] = useState<HalloweenCostume[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setRecords([]); setCanEdit(false); setError('')
    if (!enabled || loading) return
    void loadHalloweenCostumes(sessionId, token).then(data => {
      if (active) { setRecords(data); setCanEdit(true) }
    }).catch(e => {
      if (active && e?.code !== '42501') setError(e?.message || 'Could not load Halloween costumes')
    })
    return () => { active = false }
  }, [sessionId, enabled, token, user?.id, loading, rosterVersion])
  return { records, canEdit, token, error }
}
