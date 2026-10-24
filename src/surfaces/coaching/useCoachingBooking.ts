import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabaseClient'

export const COACHING_SESSION = 'first-clinic'
export type CoachingBooking = {
  session_id: string
  capacity: number
  price_thb: number
  starts_at: string | null
  booking_open: boolean
  places_left: number
  booked: boolean
}
export function useCoachingBooking() {
  const { user } = useAuth()
  const [status, setStatus] = useState<CoachingBooking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const request = useRef(0)
  const bookingInFlight = useRef(false)
  const refresh = useCallback(async () => {
    const current = ++request.current
    const { data, error: failure } = await supabase.rpc('coaching_booking_status', { p_session_id: COACHING_SESSION })
    if (current !== request.current) return
    if (failure || !data) {
      setStatus(null)
      setError('Unable to check places. Please try again.')
    } else {
      setStatus(data as CoachingBooking)
      setError(null)
    }
  }, [])
  useEffect(() => {
    setStatus(null)
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30000)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => { ++request.current; window.clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [user?.id, refresh])
  const book = async () => {
    if (bookingInFlight.current) return false
    bookingInFlight.current = true
    ++request.current
    setBusy(true)
    setError(null)
    try {
      const { data, error: failure } = await supabase.rpc('book_coaching_place', { p_session_id: COACHING_SESSION })
      if (failure || !data) {
        const message = failure?.message ?? ''
        await refresh()
        setError(message.includes('CLASS_FULL') ? 'This class is now full.'
          : message.includes('BOOKING_CLOSED') ? 'Bookings are closed.'
          : message.includes('SIGN_IN_REQUIRED') || failure?.code === '28000' ? 'Please sign in again to book.'
          : 'Booking could not be confirmed. Please try again.')
        return false
      }
      ++request.current
      setStatus(data as CoachingBooking)
      return true
    } catch {
      setError('Booking could not be confirmed. Please try again.')
      return false
    } finally { setBusy(false); bookingInFlight.current = false }
  }
  return { status, error, busy, refresh, book }
}
