import type { PlaySide } from './types'

export const PLAY_SIDES: { value: PlaySide; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
]

export function playSideLabel(side: PlaySide | null | undefined): string | null {
  if (!side) return null
  return PLAY_SIDES.find((s) => s.value === side)?.label ?? side
}

export const PLAY_STYLES = [
  'Aggressive',
  'Defensive',
  'All-court',
  'Net player',
  'Baseline',
  'Power',
  'Control',
] as const

export type PlayStyle = (typeof PLAY_STYLES)[number]

export function parsePlayStyles(raw: string | null | undefined): PlayStyle[] {
  if (!raw?.trim()) return []
  const selected: PlayStyle[] = []
  for (const part of raw.split(',')) {
    const match = PLAY_STYLES.find((s) => s.toLowerCase() === part.trim().toLowerCase())
    if (match && !selected.includes(match)) selected.push(match)
  }
  return selected
}

export function serializePlayStyles(styles: PlayStyle[]): string | null {
  if (styles.length === 0) return null
  return styles.join(', ')
}
