import type { CSSProperties } from 'react'
import type { GameCardSize } from '../../lib/viewBreakpoints'

export function isTvSize(size: GameCardSize): boolean {
  return size === 'tv'
}

export function cardFillsViewport(size: GameCardSize): boolean {
  return size === 'tablet' || size === 'web' || size === 'tv'
}

export function hideCollapseForSize(size: GameCardSize): boolean {
  return isTvSize(size)
}

function courtsGridClass(size: GameCardSize, courtCount: number): string {
  if (size === 'mobile') return 'game-card-courts-stack'

  const parts = ['game-card-courts-grid', 'min-h-0', 'flex-1']
  if (isTvSize(size)) {
    parts.push('tv-game-courts-grid')
    if (courtCount <= 1) parts.push('tv-game-courts-grid--single', 'game-card-courts-grid--single')
    else if (courtCount === 2) parts.push('tv-game-courts-grid--duo', 'game-card-courts-grid--duo')
    return parts.join(' ')
  }
  if (courtCount <= 1) parts.push('game-card-courts-grid--single')
  else if (courtCount === 2) parts.push('game-card-courts-grid--duo')
  return parts.join(' ')
}

export function courtsGridProps(
  size: GameCardSize,
  courtCount: number,
): { className: string; style?: CSSProperties } {
  const className =
    size === 'mobile' ? `${courtsGridClass(size, courtCount)} space-y-3.5` : courtsGridClass(size, courtCount)
  if (size === 'mobile') return { className }
  const rows = Math.max(1, Math.ceil(courtCount / 2))
  return {
    className,
    style: { gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` },
  }
}

export function courtsBodyClass(size: GameCardSize, finished: boolean): string {
  const finishedBg = finished ? 'border-brand-border/40 bg-brand-bg-alt/70' : 'border-brand-border/30 bg-brand-bg-alt'
  if (isTvSize(size)) {
    return `game-card-courts-body tv-game-courts-body border-t flex min-h-0 flex-1 flex-col overflow-hidden px-0.5 pb-0 pt-1 ${finishedBg}`
  }
  if (size === 'web') {
    return `game-card-courts-body border-t flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-3 lg:px-5 ${finishedBg}`
  }
  if (size === 'tablet') {
    return `game-card-courts-body border-t flex min-h-0 flex-1 flex-col overflow-hidden px-3.5 pb-3.5 pt-3 md:px-4 ${finishedBg}`
  }
  return `game-card-courts-body border-t px-3 pb-3.5 pt-3 ${finishedBg}`
}

export function courtCompactForSize(size: GameCardSize, landscape = false): boolean {
  if (isTvSize(size)) return true
  return landscape && (size === 'tablet' || size === 'web')
}

export function headerPadForSize(size: GameCardSize): string {
  if (isTvSize(size)) return 'px-3 py-2.5'
  if (size === 'web') return 'px-4 py-4 lg:px-5 lg:py-4'
  if (size === 'tablet') return 'px-3.5 py-3.5 md:px-4 md:py-4'
  return 'px-3 py-3.5'
}

export function gameTitleClassForSize(size: GameCardSize): string {
  if (isTvSize(size)) {
    return 'font-display text-4xl font-extrabold leading-none tabular-nums md:text-5xl'
  }
  if (size === 'web') {
    return 'font-display text-4xl font-extrabold leading-none tabular-nums lg:text-5xl'
  }
  if (size === 'tablet') {
    return 'font-display text-3xl font-extrabold leading-none tabular-nums md:text-4xl'
  }
  return 'font-display text-2xl font-bold leading-none tabular-nums'
}

export function headerLogoClassForSize(size: GameCardSize): string {
  const base = 'w-auto shrink-0 object-contain'
  if (isTvSize(size)) return `${base} h-44 max-w-[32rem] md:h-52 md:max-w-[38rem]`
  if (size === 'web') return `${base} h-40 max-w-[28rem] lg:h-48 lg:max-w-[34rem]`
  if (size === 'tablet') return `${base} h-36 max-w-[24rem] md:h-40 md:max-w-[28rem]`
  return `${base} h-32 max-w-[20rem]`
}

export function headerCarouselMinHeightForSize(size: GameCardSize): string {
  if (isTvSize(size)) return 'min-h-[7rem] md:min-h-[8rem]'
  if (size === 'web') return 'min-h-[6.5rem] lg:min-h-[7.5rem]'
  if (size === 'tablet') return 'min-h-[6rem]'
  return 'min-h-[5.5rem]'
}
