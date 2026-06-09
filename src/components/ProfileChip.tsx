import { useAuth } from '../hooks/useAuth'
import { useSignInChip } from '../hooks/useSignInChip'
import { useTranslation } from '../hooks/useTranslation'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { LineSignInModal } from './LineSignInModal'

type Props = {
  returnTo?: string
  className?: string
}

export function ProfileChip({ returnTo, className = '' }: Props) {
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const lineClient = useLineClientProfile()
  const { openProfile, modalOpen, setModalOpen, busy } = useSignInChip(returnTo)

  const isSignedIn = Boolean(user)
  const signInLabel = t('common.signIn')
  const name = isSignedIn
    ? firstDisplayName(profile?.display_name ?? lineClient.displayName)
    : signInLabel
  const avatarUrl = isSignedIn ? (profile?.avatar_url ?? lineClient.pictureUrl ?? null) : null
  const isAdmin = Boolean(profile?.is_admin)
  const chipClass = isAdmin
    ? 'border-brand-gold bg-brand-gold-light ring-1 ring-brand-gold/40 text-brand-gold-dark shadow-sm'
    : 'border-brand-border bg-brand-surface text-brand-primary'

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => void openProfile()}
        className={`flex h-9 max-w-[9rem] items-center gap-1.5 truncate rounded-full border pl-1.5 pr-2.5 text-xs font-medium disabled:opacity-60 md:h-11 md:max-w-[12rem] md:gap-2 md:pl-2 md:pr-3 md:text-sm ${chipClass} ${className}`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className={`h-6 w-6 shrink-0 rounded-full object-cover md:h-8 md:w-8 ${isAdmin ? 'ring-2 ring-brand-gold' : ''}`}
          />
        ) : (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold md:h-8 md:w-8 md:text-xs ${
              isAdmin ? 'bg-brand-gold/25 text-brand-gold-dark ring-2 ring-brand-gold' : 'bg-brand-bg-alt text-brand-muted'
            }`}
          >
            {isSignedIn ? name.trim()[0]?.toUpperCase() ?? '?' : signInLabel.trim()[0]?.toUpperCase() ?? '?'}
          </span>
        )}
        <span className="truncate">{busy ? t('signInModal.checkingSession') : name}</span>
      </button>
      {modalOpen ? (
        <LineSignInModal returnTo={returnTo} onClose={() => setModalOpen(false)} />
      ) : null}
    </>
  )
}
