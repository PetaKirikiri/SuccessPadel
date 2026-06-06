export const TIER_THRESHOLDS = [
  { name: 'Elite', minPoints: 100 },
  { name: 'Advanced', minPoints: 50 },
  { name: 'Intermediate', minPoints: 20 },
  { name: 'Beginner', minPoints: 0 },
] as const

export function tierFromPoints(points: number): string {
  for (const t of TIER_THRESHOLDS) {
    if (points >= t.minPoints) return t.name
  }
  return 'Beginner'
}
