import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

const RENDER_PX = 512

type Props = {
  url: string
  title?: string
  className?: string
}

export function InviteCardQr({ url, title, className = '' }: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(url, {
      width: RENDER_PX,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then((dataUrl) => {
      if (active) setSrc(dataUrl)
    })
    return () => {
      active = false
    }
  }, [url])

  const frameClass =
    'block w-full aspect-square shrink-0 rounded-xl border-2 border-brand-border bg-white shadow-sm'

  if (!src) {
    return (
      <div
        className={`${frameClass} animate-pulse bg-brand-bg-alt ${className}`}
        aria-hidden
      />
    )
  }

  return (
    <img
      src={src}
      alt=""
      title={title}
      className={`${frameClass} object-contain p-1 ${className}`}
    />
  )
}
