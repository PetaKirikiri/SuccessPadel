import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

type Props = {
  url: string
  onDataUrl?: (dataUrl: string) => void
}

export function LineSignUpQr({ url, onDataUrl }: Props) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void QRCode.toDataURL(url, {
      width: 280,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' },
    }).then(
      (dataUrl) => {
        if (!active) return
        setSrc(dataUrl)
        onDataUrl?.(dataUrl)
      },
    )
    return () => {
      active = false
    }
  }, [onDataUrl, url])

  if (!src) {
    return <div className="mx-auto h-[280px] w-[280px] max-w-full animate-pulse rounded-2xl bg-brand-border" />
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className="mx-auto block h-auto w-[280px] max-w-full rounded-2xl border border-brand-border bg-white"
    />
  )
}
