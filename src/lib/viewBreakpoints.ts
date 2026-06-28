/** Tailwind `md` — tablet / iPad portrait and up. */
export const TABLET_MIN_WIDTH_PX = 768

/** Tailwind `lg` — desktop web and up. */
export const WEB_MIN_WIDTH_PX = 1024

/** Tailwind `2xl` — TV / very large display only. Below this: phone, tablet, normal web. */
export const TV_MIN_WIDTH_PX = 1536

export type ViewportBucket = 'mobile' | 'tablet' | 'web' | 'tv'

/** @deprecated Use ViewportBucket */
export type GameCardSize = ViewportBucket

export const VIEWPORT_BUCKETS: ViewportBucket[] = ['mobile', 'tablet', 'web', 'tv']

export function isViewportBucket(value: string | null | undefined): value is ViewportBucket {
  return VIEWPORT_BUCKETS.includes(value as ViewportBucket)
}

export function viewportFromWidth(widthPx: number): ViewportBucket {
  if (widthPx >= TV_MIN_WIDTH_PX) return 'tv'
  if (widthPx >= WEB_MIN_WIDTH_PX) return 'web'
  if (widthPx >= TABLET_MIN_WIDTH_PX) return 'tablet'
  return 'mobile'
}

/** @deprecated Use viewportFromWidth */
export function gameCardSizeFromWidth(widthPx: number): GameCardSize {
  return viewportFromWidth(widthPx)
}
