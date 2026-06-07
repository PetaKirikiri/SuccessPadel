import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { usePublicCompetition } from '../hooks/usePublicCompetition'
import { rosterDisplayName } from '../hooks/useCompetitions'
import { AppTopBar } from '../components/AppTopBar'
import { supabase } from '../lib/supabaseClient'

export function CompetitionJoin() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { session: authSession, profile, loading: authLoading } = useAuth()
  const { session, roster, loading, error: loadError, refresh } = usePublicCompetition(id)
  const [name, setName] = useState('')
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
    if (profile?.display_name && !name) setName(profile.display_name)
  }, [profile?.display_name, name])

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

  const joinWithName = async () => {
    if (!id) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('competition.enterName'))
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('self_join_competition_guest', {
      p_session_id: id,
      p_display_name: trimmed,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setDone(true)
    await refresh(true)
  }

  const showSuccess = done || alreadyIn
  const displayName = (profile?.display_name ?? name.trim()) || t('common.thanks')

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
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="font-display text-xl font-semibold text-brand-primary">
                {session.title}
              </h1>
              <p className="mt-1 text-sm text-brand-muted">{t('competition.joinTitle')}</p>
            </div>

            <div className="game-card space-y-3 px-4 py-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-brand-muted">
                {t('competition.yourName')}
              </label>
              <input
                type="text"
                value={name}
                disabled={busy || authLoading}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('competition.namePlaceholder')}
                className="brand-input w-full"
                autoComplete="name"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void joinWithName()}
                className="brand-btn w-full py-2.5 font-semibold"
              >
                {busy ? t('competition.adding') : t('competition.addMe')}
              </button>
            </div>

            {roster.length > 0 && (
              <div className="game-card px-4 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  {t('competition.onTheList', { count: roster.length })}
                </p>
                <ul className="space-y-1 text-sm text-brand-text">
                  {roster.map((r) => (
                    <li key={r.id}>{rosterDisplayName(r)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
      </main>
    </div>
  )
}
