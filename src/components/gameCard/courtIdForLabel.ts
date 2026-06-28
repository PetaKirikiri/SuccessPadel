import type { LiveCourt } from './gameBoardTypes'

export function courtIdForLabel(
  courtLabel: string,
  courtIndex: number,
  courtsForGame: LiveCourt[],
  courtIdByLabel?: Map<string, string>,
): string | undefined {
  const live = courtsForGame.find(
    (c) => c.courtName === courtLabel || c.courtName.toLowerCase() === courtLabel.toLowerCase(),
  )?.courtId
  if (live) return live
  const exact = courtIdByLabel?.get(courtLabel)
  if (exact) return exact
  for (const [name, id] of courtIdByLabel ?? []) {
    if (name.toLowerCase() === courtLabel.toLowerCase()) return id
  }
  const ordered = [...(courtIdByLabel?.values() ?? [])]
  return ordered[courtIndex]
}
