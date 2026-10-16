export type DirectoryMember = {
  id: string
  display_name: string
  avatar_url: string | null
  gender: string | null
  skill_level: string | null
  history_levels: string[]
  court_member: boolean | null
}
export function memberGender(gender: string | null): 'Women' | 'Men' | 'Gender not set' {
  if (['female', 'woman', 'women'].includes(gender?.toLowerCase() ?? '')) return 'Women'
  if (['male', 'man', 'men'].includes(gender?.toLowerCase() ?? '')) return 'Men'
  return 'Gender not set'
}
function levelBand(value: string | null): 'Beginner' | 'Intermediate' | 'Advanced' | 'Open' | null {
  if (value === 'Beginner') return 'Beginner'
  if (value === 'Low Inter' || value === 'Intermediate') return 'Intermediate'
  if (value === 'Open') return 'Open'
  if (value === 'Advanced') return 'Advanced'
  return null
}
/** Event participation is evidence of category, not a measured skill rating. */
export function memberLevel(member: Pick<DirectoryMember, 'skill_level' | 'history_levels'>) {
  const assigned = levelBand(member.skill_level)
  if (assigned) return { label: assigned, source: 'Assigned', detail: `Recorded level: ${member.skill_level}` }
  const history = member.history_levels.slice(0, 5).map(levelBand).filter(level => level !== null)
  if (history.length < 2) return { label: 'Unrated', source: '', detail: 'Not enough recorded competition history' }
  const votes = ['Beginner', 'Intermediate', 'Advanced'].map(label => ({ label, count: history.filter(level => level === label).length }))
    .sort((a, b) => b.count - a.count)
  if (votes[0].count <= history.length / 2) return { label: 'Unrated', source: '', detail: 'Mixed competition history; needs assessment' }
  return { label: votes[0].label, source: 'Estimated', detail: `${votes[0].count} of ${history.length} recent played competitions in this category; not an assessed ability rating` }
}

export type DirectoryPatch = Partial<Pick<DirectoryMember, 'gender' | 'skill_level' | 'court_member'>>
