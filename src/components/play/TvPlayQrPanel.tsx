import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useTranslation } from '../../hooks/useTranslation'

const QR_SIZE = 88
const QR_SIZE_HEADER = 44

type Props = {
  url: string
  /** Compact QR in the TV game card header (brown bar). */
  header?: boolean
}

export function TvPlayQrPanel({ url, header = false }: Props) {
  const { t } = useTranslation()
  const [src, setSrc] = useState<string | null>(null)
  const size = header ? QR_SIZE_HEADER : QR_SIZE

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(url, {
      width: size * 3,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then((dataUrl) => {
      if (active) setSrc(dataUrl)
    })
    return () => {
      active = false
    }
  }, [url, size])

  if (header) {
    return src ? (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="tv-game-header-qr"
        title={t('leaderboard.viewAlongHint')}
      />
    ) : (
      <div className="tv-game-header-qr tv-play-qr-skeleton" aria-hidden />
    )
  }

  return (
    <aside className="tv-play-qr" aria-label={t('leaderboard.viewAlongHint')}>
      <p className="tv-play-qr-label">{t('leaderboard.viewAlongHint')}</p>
      {src ? (
        <img src={src} alt="" width={QR_SIZE} height={QR_SIZE} className="tv-play-qr-code" />
      ) : (
        <div className="tv-play-qr-code tv-play-qr-skeleton" aria-hidden />
      )}
    </aside>
  )
}
