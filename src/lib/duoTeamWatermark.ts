/** Optional duo team card watermark (label match, case-insensitive). */
export function duoTeamWatermarkUrl(label: string): string | null {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, ' ')
  if (normalized === 'team 7') return '/team-watermarks/team-7.png'
  return null
}
