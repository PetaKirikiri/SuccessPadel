import { UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'

export function AdminAddMemberAction({ label }: { label: string }) {
  return <Link className="profile-add-member" to="/members?add=1#add-member">
    <UserPlus className="profile-add-member__icon" aria-hidden="true" />
    <span>{label}</span>
  </Link>
}
