import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { QrCode } from 'lucide-react'
import { useGameCardSize } from '../../hooks/useGameCardSize'
import { createLinePlayerLinkRequest } from '../../lib/line/playerLink'
import { supabase } from '../../lib/supabaseClient'

async function signupImage(eventId: string, rosterId: string) {
  const { data, error } = await supabase.rpc('court_signup_player', {
    p_session_id: eventId,
    p_roster_id: rosterId,
  })
  if (error || !data) throw new Error('Player unavailable')
  const { request } = await createLinePlayerLinkRequest(eventId, data)
  if (!request) throw new Error('Signup unavailable')
  return QRCode.toDataURL(request.qrUrl, { width: 360, margin: 4, errorCorrectionLevel: 'M' })
}

export function CourtSignupCode({ eventId, rosterId }: { eventId: string; rosterId: string }) {
  const size = useGameCardSize()
  const wide = size === 'web' || size === 'tv'
  const [src, setSrc] = useState('')
  useEffect(() => {
    let current = true
    setSrc('')
    if (wide) void signupImage(eventId, rosterId).then(image => {
      if (current) setSrc(image)
    }).catch(() => { /* The button can still open the signup panel and retry. */ })
    return () => { current = false }
  }, [wide, eventId, rosterId])
  return wide && src ? <img src={src} alt="" /> : <QrCode aria-hidden="true" />
}
