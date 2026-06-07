import { useEffect } from 'react'
import { LineAppBookmark } from '../components/LineAppBookmark'
import { ProfileDetailsForm } from '../components/ProfileDetailsForm'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { useLineClientProfile } from '../hooks/useLineClientProfile'

export function Profile() {
  const { t } = useTranslation()
  const { profile, signOut, refreshProfile } = useAuth()
  const { inClient } = useLineClientProfile()

  useEffect(() => {
    void refreshProfile()
    window.scrollTo(0, 0)
  }, [refreshProfile])

  if (!profile) {
    return <p className="py-6 text-center text-xs text-brand-muted">…</p>
  }

  return (
    <div className="space-y-4 pb-8">
      {inClient ? <LineAppBookmark /> : null}
      <ProfileDetailsForm profile={profile} onSaved={() => void refreshProfile()} />

      <button
        type="button"
        onClick={() => void signOut()}
        className="block w-full py-2 text-center text-xs text-brand-muted"
      >
        {t('profile.signOut')}
      </button>
    </div>
  )
}
