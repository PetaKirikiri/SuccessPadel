export type DirectoryMember = {
  id: string
  display_name: string
  avatar_url: string | null
  gender: string | null
  skill_level: string | null
  history_levels: string[]
  directory_hidden: boolean
  has_line_account: boolean
  court_member: boolean | null
  line_contact_url?: string | null
  whatsapp_number?: string | null
  country?: string | null
  residency_status?: 'local' | 'holiday' | null
  contacts_loaded?: boolean
}
export function memberGender(gender: string | null): 'Women' | 'Men' | 'Gender not set' {
  if (['female', 'woman', 'women'].includes(gender?.toLowerCase() ?? '')) return 'Women'
  if (['male', 'man', 'men'].includes(gender?.toLowerCase() ?? '')) return 'Men'
  return 'Gender not set'
}
export const MEMBER_SKILL_LEVELS = ['Beginner', 'Low Inter', 'Intermediate', 'Advanced'] as const
export function memberLevel(member: Pick<DirectoryMember, 'skill_level' | 'history_levels'>) {
  const assigned = MEMBER_SKILL_LEVELS.find(level => level === member.skill_level)
  return assigned
    ? { label: assigned, source: 'Assigned', detail: `Recorded level: ${assigned}` }
    : { label: 'Beginner' as const, source: '', detail: 'Beginner by default until a level is assigned' }
}

export type DirectoryPatch = Partial<Pick<DirectoryMember, 'gender' | 'skill_level' | 'court_member' | 'directory_hidden' | 'display_name' | 'avatar_url' | 'line_contact_url' | 'whatsapp_number' | 'country' | 'residency_status'>>
