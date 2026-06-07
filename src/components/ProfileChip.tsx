import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { saveReturnTo } from '../lib/authReturnTo'
import { firstDisplayName } from '../lib/leaderboardEntries'

type Props = {
  returnTo?: string
  className?: string
}

export function ProfileChip({ returnTo, className = '' }: Props) {
  const { profile, user } = useAuth()
  const lineClient = useLineClientProfile()
  const navigate = useNavigate()
  const loc = useLocation()

  const isSignedIn = Boolean(user)
  const name = isSignedIn
    ? firstDisplayName(profile?.display_name ?? lineClient.displayName)
    : 'Guest'
  const avatarUrl = isSignedIn ? (profile?.avatar_url ?? lineClient.pictureUrl ?? null) : null

  const openProfile = () => {
    if (isSignedIn) {
      if (loc.pathname === '/profile') return
      navigate('/profile')
      return
    }
    if (loc.pathname === '/login') return
    saveReturnTo(returnTo ?? loc.pathname)
    navigate('/login')
  }

  return (
    <button
      type="button"
      onClick={openProfile}
      className={`flex max-w-[8.5rem] items-center gap-1.5 truncate rounded-full border border-brand-border bg-brand-surface py-1.5 pl-1.5 pr-2.5 text-xs font-medium text-brand-primary ${className}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-[10px] font-semibold text-brand-muted">
          {isSignedIn ? name.trim()[0]?.toUpperCase() ?? '?' : 'G'}
        </span>
      )}
      <span className="truncate">{name}</span>
    </button>
  )
}
