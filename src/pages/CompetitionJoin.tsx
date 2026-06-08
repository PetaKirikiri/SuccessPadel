import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import { AppTopBar } from '../components/AppTopBar'
import { supabase } from '../lib/supabaseClient'

export function CompetitionJoin() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { session: authSession, profile, loading: authLoading } = useAuth()
  const { session, roster, loading, error: loadError, refresh } = usePublicCompetition(id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const autoJoinAttempted = useRef(false)

  const userId = authSession?.user?.id
  const signupsOpen = Boolean(
    session?.status === 'open' && !session.competition_started_at,
  )
  const alreadyIn = userId
    ? roster.some((r) => r.profile_id === userId)
    : false

  useEffect(() => {
    if (!id || !userId || !signupsOpen || alreadyIn || done || autoJoinAttempted.current) return
    autoJoinAttempted.current = true
    void joinWithAccount()
  }, [id, userId, signupsOpen, alreadyIn, done])

  const joinWithAccount = async () => {
    if (!id) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('join_competition', { p_session_id: id })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setDone(true)
    await refresh(true)
  }

  const showSuccess = done || alreadyIn
  const displayName = profile?.display_name?.trim() || t('common.thanks')

  return (
    <div className="game-bg flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <AppTopBar className="py-3">
        <img
          src="/brand/logo-padel.webp"
          alt={t('common.brandAlt')}
          className="h-8 w-auto max-w-[10rem] md:h-10 md:max-w-[12rem]"
        />
      </AppTopBar>

      <main
        data-scroll-y
        className="scroll-y mx-auto min-h-0 w-full max-w-md flex-1 px-4 pb-8 pt-2 md:max-w-xl md:px-6"
      >
        {loading && !session ? (
          <p className="py-8 text-center text-sm text-brand-muted">{t('common.loading')}</p>
        ) : !session ? (
          <p className="py-8 text-center text-sm text-red-600">
            {loadError ?? t('competition.notFound')}
          </p>
        ) : !signupsOpen ? (
          <p className="py-8 text-center text-sm text-brand-muted">{t('competition.signupsClosed')}</p>
        ) : !userId && !authLoading ? (
          <div className="game-card space-y-3 px-4 py-6 text-center">
            <p className="font-display text-lg font-semibold text-brand-primary">
              {t('competition.guestSignupDisabled')}
            </p>
            <p className="text-sm text-brand-muted">{t('competition.guestSignupHint')}</p>
            <Link to={`/competitions/${id}`} className="brand-btn inline-block px-6 py-2.5 font-semibold">
              {t('competition.viewGame')}
            </Link>
          </div>
        ) : showSuccess ? (
          <div className="game-card space-y-3 px-4 py-6 text-center">
            <p className="font-display text-lg font-semibold text-brand-primary">
              {t('competition.onTheListSuccess')}
            </p>
            <p className="text-sm text-brand-muted">
              {t('competition.onTheListHint', { name: displayName })}
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <h1 className="font-display text-xl font-semibold text-brand-primary">{session.title}</h1>
            <p className="text-sm text-brand-muted">
              {busy ? t('competition.adding') : t('competition.joinTitle')}
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
      </main>
    </div>
  )
}
