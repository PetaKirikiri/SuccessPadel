import { useEffect } from 'react'
import { ProfileDetailsForm } from '../components/ProfileDetailsForm'
import { useAuth } from '../hooks/useAuth'

export function Profile() {
  const { profile, signOut, refreshProfile } = useAuth()

  useEffect(() => {
    void refreshProfile()
    window.scrollTo(0, 0)
  }, [refreshProfile])

  if (!profile) {
    return <p className="py-6 text-center text-xs text-brand-muted">…</p>
  }

  return (
    <div className="space-y-4 pb-8">
      <ProfileDetailsForm profile={profile} onSaved={() => void refreshProfile()} />

      <button
        type="button"
        onClick={() => void signOut()}
        className="block w-full py-2 text-center text-xs text-brand-muted"
      >
        Sign out
      </button>
    </div>
  )
}
