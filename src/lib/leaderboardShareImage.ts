export type CopyLeaderboardImageResult = 'copied' | 'shared' | 'downloaded'

export type AvatarEmbeddableRow = {
  avatarUrl?: string | null
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('avatar-data-url-failed'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('avatar-read-failed'))
    reader.readAsDataURL(blob)
  })
}

function normalizeImageUrl(url: string): string {
  try {
    return new URL(url, window.location.origin).href
  } catch {
    return url
  }
}

function findLoadedImage(url: string): HTMLImageElement | null {
  const target = normalizeImageUrl(url)
  for (const img of document.querySelectorAll('img')) {
    if (!img.complete || img.naturalWidth === 0) continue
    const src = img.currentSrc || img.src
    if (src === target || normalizeImageUrl(src) === target) return img
  }
  return null
}

function canvasFromImage(img: HTMLImageElement): string | null {
  try {
    const size = Math.max(img.naturalWidth, img.naturalHeight, 1)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, size, size)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

async function resolveImageForCapture(url: string): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:')) return url
  if (url.startsWith('/') || url.startsWith(window.location.origin)) return url

  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
    if (res.ok) return await blobToDataUrl(await res.blob())
  } catch {
    // try image element below
  }

  const corsLoaded = await loadImageWithCors(url)
  if (corsLoaded) return corsLoaded

  const loaded = findLoadedImage(url)
  if (loaded) return canvasFromImage(loaded)

  return null
}

function loadImageWithCors(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(canvasFromImage(img))
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Inline remote avatars as data URLs so html-to-image can paint them. */
export async function embedRowAvatars<T extends AvatarEmbeddableRow>(rows: T[]): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (!row.avatarUrl) return row
      const embedded = await resolveImageForCapture(row.avatarUrl)
      return embedded ? { ...row, avatarUrl: embedded } : { ...row, avatarUrl: null }
    }),
  )
}

async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  )
}

function captureOptions(stripRemoteImages: boolean) {
  const isSafeSrc = (src: string) =>
    !src ||
    src.startsWith('data:') ||
    src.startsWith('/') ||
    src.startsWith(window.location.origin)

  return {
    cacheBust: true,
    skipFonts: true,
    pixelRatio: 2,
    backgroundColor: '#fdfaf5',
    filter: (el: HTMLElement) => {
      if (el.tagName !== 'IMG') return true
      if (stripRemoteImages) return false
      const src = el.getAttribute('src') ?? ''
      return isSafeSrc(src)
    },
  }
}

async function renderLeaderboardBlob(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import('html-to-image')
  await waitForImages(node)
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  let blob = await toBlob(node, captureOptions(false))
  if (!blob) {
    blob = await toBlob(node, captureOptions(true))
  }
  if (!blob) throw new Error('leaderboard-image-render-failed')
  return blob
}

export async function copyLeaderboardImage(
  node: HTMLElement,
  title?: string,
): Promise<CopyLeaderboardImageResult> {
  const blob = await renderLeaderboardBlob(node)
  const file = new File([blob], 'leaderboard.png', { type: 'image/png' })

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title ?? 'Leaderboard' })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
    }
  }

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'copied'
    } catch {
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'leaderboard.png'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
