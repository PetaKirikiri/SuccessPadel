// Mirrors the stable rank/name contract in public.padel_skill_levels.
const LEVEL_NAMES = ['Beginner', 'Low Inter', 'Inter', 'High Inter', 'Advanced', 'Advanced Plus'] as const

type CompetitionLevel = {
  skill_level?: string | null
  skill_level_min_rank?: number | null
  skill_level_max_rank?: number | null
}

export function competitionLevelLabel(row: CompetitionLevel): string | null {
  const min = row.skill_level_min_rank
  const max = row.skill_level_max_rank
  if (min != null && max != null && Number.isInteger(min) && Number.isInteger(max)
    && min >= 1 && max <= LEVEL_NAMES.length && min <= max) {
    return min === max ? LEVEL_NAMES[min - 1] : `${LEVEL_NAMES[min - 1]}–${LEVEL_NAMES[max - 1]}`
  }
  if (row.skill_level === 'Open') return 'All levels'
  if (row.skill_level === 'Intermediate') return 'Inter'
  return LEVEL_NAMES.find(name => name === row.skill_level) ?? null
}

// Hide a redundant legacy title suffix only when it agrees with the saved declaration.
export function competitionInviteTitle(title: string, level: string | null): string {
  if (!level) return title
  const normalize = (value: string) => value.toLowerCase()
    .replace(/intermediate/g, 'inter').replace(/\s*[~–—-]\s*/g, '–').trim()
  const parts = title.split(/\s*[·•]\s*/)
  if (parts.length > 1 && normalize(parts[parts.length - 1]) === normalize(level)) parts.pop()
  return parts.join(' · ')
}
