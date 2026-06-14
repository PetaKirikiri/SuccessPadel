import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'

const QR_SIZE = 240

type Props = {
  url: string
}

export function LeaderboardViewAlongQrPanel({ url }: Props) {
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
    <aside className="leaderboard-view-along-qr" aria-label={t('leaderboard.viewAlongHint')}>
      {src ? (
        <img
          src={src}
          alt=""
          width={QR_SIZE}
          height={QR_SIZE}
          className="leaderboard-view-along-qr-code"
        />
      ) : (
        <div className="leaderboard-view-along-qr-code leaderboard-view-along-qr-skeleton" aria-hidden />
      )}
      <p className="leaderboard-view-along-qr-label">{t('leaderboard.viewAlongHint')}</p>
    </aside>
  )
}
