import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

const SIZE = 56

type Props = {
  url: string
  title?: string
}

export function InviteCardQr({ url, title }: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(url, {
      width: SIZE * 4,
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

  if (!src) {
    return (
      <div
        className="h-14 w-14 shrink-0 animate-pulse rounded-xl border border-brand-border bg-brand-bg-alt"
        aria-hidden
      />
    )
  }

  return (
    <img
      src={src}
      alt=""
      width={SIZE}
      height={SIZE}
      title={title}
      className="h-14 w-14 shrink-0 rounded-xl border border-brand-border bg-white p-0.5 shadow-sm"
    />
  )
}
