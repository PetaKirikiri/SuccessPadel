import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { saveReturnTo } from '../lib/authReturnTo'
import { firstDisplayName } from '../lib/leaderboardEntries'

type Props = {
  returnTo?: string
  className?: string
}

export function ProfileChip({ returnTo, className = '' }: Props) {
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const lineClient = useLineClientProfile()
  const navigate = useNavigate()
  const loc = useLocation()

  const isSignedIn = Boolean(user)
  const signInLabel = t('common.signIn')
  const name = isSignedIn
    ? firstDisplayName(profile?.display_name ?? lineClient.displayName)
    : signInLabel
  const avatarUrl = isSignedIn ? (profile?.avatar_url ?? lineClient.pictureUrl ?? null) : null

  const openProfile = () => {
    if (isSignedIn && user) {
      const path = `/players/${user.id}`
      if (loc.pathname === path) return
      navigate(path)
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
      className={`flex h-9 max-w-[9rem] items-center gap-1.5 truncate rounded-full border border-brand-border bg-brand-surface pl-1.5 pr-2.5 text-xs font-medium text-brand-primary md:h-11 md:max-w-[12rem] md:gap-2 md:pl-2 md:pr-3 md:text-sm ${className}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-6 w-6 shrink-0 rounded-full object-cover md:h-8 md:w-8"
        />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-bg-alt text-[10px] font-semibold text-brand-muted md:h-8 md:w-8 md:text-xs">
          {isSignedIn ? name.trim()[0]?.toUpperCase() ?? '?' : signInLabel.trim()[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span className="truncate">{name}</span>
    </button>
  )
}
