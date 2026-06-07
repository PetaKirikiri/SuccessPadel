import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { saveReturnTo } from '../lib/authReturnTo'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const { t } = useTranslation()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">{t('common.loading')}</p>
      </div>
    )
  }
  if (!session) {
    saveReturnTo(loc.pathname)
    return (
      <Navigate to="/login" state={{ from: loc.pathname }} replace />
    )
  }
  return children
}
