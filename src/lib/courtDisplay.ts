import type { TranslateFn } from '../i18n'

const NUMBERED_COURT = /^Court\s+(\d+)$/i

/** Localize DB/default labels like "Court 1". Custom names pass through unchanged. */
export function displayCourtLabel(label: string, t: TranslateFn): string {
  const match = label.match(NUMBERED_COURT)
  if (match) return t('court.label', { number: match[1]! })
  return label
}
