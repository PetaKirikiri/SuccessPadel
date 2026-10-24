import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Users } from 'lucide-react'
import { useLocale } from '../../providers/LocaleProvider'
import { useAuth } from '../../hooks/useAuth'
import { useSignInChip } from '../../hooks/useSignInChip'
import { LineSignInModal } from '../../shared/Modal/LineSignInModal'
import { saveReturnTo } from '../../lib/authReturnTo'
import { useCoachingBooking } from './useCoachingBooking'

const RETURN_TO = '/coaching?book=1'
export function CoachingBooking({ t, language }: { t: (text: string) => string; language: 'en' | 'th' }) {
  const { setLocale } = useLocale()
  const { user, profile, loading, restoreSession } = useAuth()
  const { modalOpen, setModalOpen, openProfile, busy: signInBusy } = useSignInChip(RETURN_TO)
  const { status, error, busy, refresh, book } = useCoachingBooking()
  const [params, setParams] = useSearchParams()
  const [confirming, setConfirming] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const action = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (params.get('book') !== '1' || loading || !user) return
    setModalOpen(false)
    setConfirming(true)
    const next = new URLSearchParams(params)
    next.delete('book')
    setParams(next, { replace: true })
  }, [params, user, loading, setParams, setModalOpen])
  useEffect(() => {
    if (confirming) dialog.current?.showModal()
    else if (dialog.current?.open) dialog.current.close()
  }, [confirming])
  const beginBooking = async () => {
    setLocale(language)
    if (user) { setConfirming(true); return }
    const session = await restoreSession()
    if (session?.user) { setConfirming(true); return }
    // The existing sign-in hook and modal own all account/session behaviour.
    setParams(previous => { const next = new URLSearchParams(previous); next.set('book', '1'); return next }, { replace: true })
    await openProfile()
  }
  const close = () => { if (!busy) { setConfirming(false); action.current?.focus() } }
  const full = status !== null && status.places_left === 0
  const closed = status !== null && (!status.booking_open || Boolean(status.starts_at && Date.parse(status.starts_at) <= Date.now()))
  const available = status && !closed && !full
  const places = status ? `${status.places_left} ${t(status.places_left === 1 ? 'place left' : 'places left')}` : t('Checking places…')
  return <>
    <div className="clinic-booking-action" id="clinic-booking">
      <span className="clinic-booking-count" aria-live="polite"><Users aria-hidden="true"/>{status?.booked ? t('Your place is booked') : closed ? t('Bookings are closed.') : places}</span>
      <button ref={action} type="button" className="clinic-book-now" disabled={loading || signInBusy || busy || !available || status?.booked} onClick={() => void beginBooking()}>
        {status?.booked ? <><Check aria-hidden="true"/>{t('Booked')}</> : signInBusy ? t('Signing in…') : full ? t('Class full') : t('Book now')}
      </button>
      {error && <span className="clinic-booking-error" role="alert">{t(error)} <button type="button" onClick={() => void refresh()}>{t('Try again')}</button></span>}
      {!loading && !user && <Link className="clinic-account-setup" to="/members" onClick={() => saveReturnTo(RETURN_TO)}>{t('No account? Set up with your player QR.')}</Link>}
    </div>
    {modalOpen && <LineSignInModal returnTo={RETURN_TO} onClose={() => setModalOpen(false)}/>}
    <dialog ref={dialog} className="clinic-booking-dialog" aria-labelledby="clinic-booking-title" onCancel={event => { event.preventDefault(); close() }} onClose={() => setConfirming(false)}>
      <h2 id="clinic-booking-title">{status?.booked ? t('Your place is booked') : t('Book your place')}</h2>
      {profile?.display_name && <p className="clinic-booking-name">{profile.display_name}</p>}
      <p className="clinic-booking-detail">{status?.price_thb ?? 500} {t('THB')} · {t('60 minutes')}</p>
      <p>{status?.starts_at ? new Date(status.starts_at).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) : t('Date and time to be confirmed.')}</p>
      {status?.booked ? <p role="status">{t('Saved to your Success Padel account.')}</p> : <p>{t('No payment is taken here.')}</p>}
      {error && <p className="clinic-booking-error" role="alert">{t(error)}</p>}
      <div className="clinic-booking-dialog-actions">
        {!status?.booked && <button className="clinic-book-now" type="button" disabled={busy || !available} onClick={() => void book()}>{busy ? t('Booking…') : t('Confirm booking')}</button>}
        <button className="clinic-booking-close" type="button" disabled={busy} onClick={close}>{t(status?.booked ? 'Done' : 'Cancel')}</button>
      </div>
    </dialog>
  </>
}
