import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { AttendanceStatus } from '../components/competition-formats/rosterContract'
type AttendanceRow = { roster_entry_id: string; status: AttendanceStatus }
const SHARED_ATTENDANCE_LOAD_ERROR = 'Could not load shared attendance. Check your connection before responding.'
function attendanceStorageKey(sessionId: string): string {
  return `success-padel:attendance:${sessionId}`
}

function readLocalAttendance(sessionId: string): Record<string, AttendanceStatus> {
  try {
    return JSON.parse(localStorage.getItem(attendanceStorageKey(sessionId)) ?? '{}') as Record<string, AttendanceStatus>
  } catch {
    return {}
  }
}

function writeLocalAttendance(sessionId: string, attendance: Record<string, AttendanceStatus>): void {
  try {
    localStorage.setItem(attendanceStorageKey(sessionId), JSON.stringify(attendance))
  } catch {
    /* Database persistence remains the primary path. */
  }
}


export function useCompetitionAttendance(sessionId: string, enabled = true) {
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const saving = useRef(false)
  const revision = useRef(0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    setAttendance(readLocalAttendance(sessionId))
    const load = async () => {
      const version = revision.current
      const { data, error: loadError } = await supabase
        .from('competition_attendance')
        .select('roster_entry_id, status')
        .eq('session_id', sessionId)
      if (!active || saving.current || version !== revision.current) return
      if (loadError) { setError(SHARED_ATTENDANCE_LOAD_ERROR); return }
      setError((current) => current === SHARED_ATTENDANCE_LOAD_ERROR ? null : current)
      const shared = Object.fromEntries((data as AttendanceRow[] ?? []).map((item) => [item.roster_entry_id, item.status]))
      setAttendance(shared)
      writeLocalAttendance(sessionId, shared)
    }
    void load()
    const refreshOnFocus = () => { if (!document.hidden) void load() }
    const poll = window.setInterval(refreshOnFocus, 15000)
    window.addEventListener('focus', refreshOnFocus)

    const channel = supabase
      .channel(`competition-attendance:${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'competition_attendance', filter: `session_id=eq.${sessionId}` },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      active = false
      window.clearInterval(poll)
      window.removeEventListener('focus', refreshOnFocus)
      void supabase.removeChannel(channel)
    }
  }, [sessionId, enabled])

  const updateAttendance = async (rosterEntryId: string, nextStatus: AttendanceStatus) => {
    if (saving.current) return
    saving.current = true
    revision.current += 1
    const previousStatus = attendance[rosterEntryId] ?? 'pending'
    setBusyPlayerId(rosterEntryId)
    setError(null)
    setAttendance((current) => {
      const next = { ...current, [rosterEntryId]: nextStatus }
      return next
    })
    try {
      const { error: updateError } = await supabase.rpc('set_competition_attendance', {
        p_session_id: sessionId,
        p_roster_entry_id: rosterEntryId,
        p_status: nextStatus,
      })
      if (updateError) throw updateError
      setAttendance((current) => {
        const next = { ...current, [rosterEntryId]: nextStatus }
        writeLocalAttendance(sessionId, next)
        return next
      })
    } catch (cause) {
      setAttendance((current) => ({ ...current, [rosterEntryId]: previousStatus }))
      const message = cause && typeof cause === 'object' && 'message' in cause
        ? String(cause.message) : 'Check your connection and try again.'
      setError(`Attendance was not saved: ${message}`)
    } finally {
      saving.current = false
      revision.current += 1
      setBusyPlayerId(null)
    }
  }

  return { attendance, busyPlayerId, error, updateAttendance }
}
