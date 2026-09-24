import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Smartphone } from 'lucide-react'

export function CompetitionReviewQr({ url, playerName }: { url: string; playerName: string }) {
  const [image, setImage] = useState<{ url: string; src: string } | null>(null)
  useEffect(() => {
    let active = true
    void QRCode.toDataURL(url, { width: 480, margin: 4, errorCorrectionLevel: 'M' })
      .then(src => { if (active) setImage({ url, src }) })
      .catch(() => { if (active) setImage(null) })
    return () => { active = false }
  }, [url])
  return <a className="competition-review__qr" href={url} aria-label={`Open ${playerName}'s full review on your phone`}>
    <div><Smartphone aria-hidden="true" /><strong>Take your review with you</strong><span>Scan for {playerName}’s full review</span></div>
    {image?.url === url ? <img src={image.src} alt={`QR code for ${playerName}'s competition review`} /> : <span>Open review ↗</span>}
  </a>
}
