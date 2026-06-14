import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useTranslation } from '../../hooks/useTranslation'

/** TV standings column only — smaller QR, bottom-left, never fixed over scores. */
const QR_SIZE = 120

type Props = {
  url: string
}

export function TvPlayQrPanel({ url }: Props) {
  const { t } = useTranslation()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(url, {
      width: QR_SIZE * 3,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then((dataUrl) => {
      if (active) setSrc(dataUrl)
    })
    return () => {
      active = false
    }
  }, [url])

  return (
    <aside className="tv-play-qr" aria-label={t('leaderboard.viewAlongHint')}>
      <p className="tv-play-qr-label">{t('leaderboard.viewAlongHint')}</p>
      {src ? (
        <img
          src={src}
          alt=""
          width={QR_SIZE}
          height={QR_SIZE}
          className="tv-play-qr-code"
        />
      ) : (
        <div className="tv-play-qr-code tv-play-qr-skeleton" aria-hidden />
      )}
    </aside>
  )
}
