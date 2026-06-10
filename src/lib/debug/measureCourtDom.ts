import type { NormalizedPoint } from '../gestureCapture'
import { padNormToCourtNorm, type CourtInsetBounds } from '../padelCourtLayout'

export type DomRectSnapshot = {
  left: number
  top: number
  width: number
  height: number
  centerX: number
  centerY: number
}

function rectSnapshot(rect: DOMRect, origin: DOMRect): DomRectSnapshot {
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + rect.width / 2 - origin.left,
    centerY: rect.top + rect.height / 2 - origin.top,
  }
}

/** Snapshot player coins and rally wheels relative to the court surface element. */
export function measureCourtPickerDom(courtEl: HTMLElement | null): Record<string, unknown> | null {
  if (!courtEl) return null
  const courtRect = courtEl.getBoundingClientRect()
  const playerCoins = Array.from(
    courtEl.querySelectorAll<HTMLElement>('[data-player-coin]'),
  ).map((el) => ({
    quadrant: el.dataset.playerCoin,
    ...rectSnapshot(el.getBoundingClientRect(), courtRect),
  }))
  const rallyWheels = Array.from(
    courtEl.querySelectorAll<HTMLElement>('[data-rally-wheel]'),
  ).map((el) => ({
    title: el.dataset.rallyWheel,
    anchorStyle: { left: el.style.left, top: el.style.top },
    ...rectSnapshot(el.getBoundingClientRect(), courtRect),
  }))
  const serveLabels = Array.from(
    courtEl.querySelectorAll<HTMLElement>('[data-serve-label]'),
  ).map((el) => ({
    quadrant: el.dataset.serveLabel,
    ...rectSnapshot(el.getBoundingClientRect(), courtRect),
  }))
  const rallyButtons = Array.from(
    courtEl.querySelectorAll<HTMLButtonElement>('[data-rally-shot]'),
  ).map((btn) => {
    const wheel = btn.closest('[data-rally-wheel]')
    const wheelRect = wheel?.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    return {
      shot: btn.dataset.rallyShot,
      wheel: wheel?.getAttribute('data-rally-wheel'),
      centerInCourt: rectSnapshot(btnRect, courtRect),
      centerInWheel: wheelRect
        ? {
            x: btnRect.left + btnRect.width / 2 - wheelRect.left,
            y: btnRect.top + btnRect.height / 2 - wheelRect.top,
          }
        : null,
    }
  })
  return {
    court: rectSnapshot(courtRect, courtRect),
    playerCoins,
    serveLabels,
    rallyWheels,
    rallyButtons,
  }
}

export function padPointToCourt(
  pad: NormalizedPoint,
  inset: CourtInsetBounds | null,
): NormalizedPoint | null {
  return inset ? padNormToCourtNorm(pad, inset) : null
}
