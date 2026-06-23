import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppTopBar } from '../components/AppTopBar'
import { AppShellColumn } from '../components/AppShellColumn'
import { GameLineupSprite } from '../components/GameLineupSprite'
import { PixelAvatarEditor } from '../components/PixelAvatarEditor'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { resolvePlayerProfile } from '../lib/playerProfile'
import { defaultPixelAvatarConfig, normalizePixelAvatarConfig } from '../lib/pixelAvatar/defaults'
import { resolveGameSpriteForCharacter } from '../lib/pixelAvatar/resolveCharacterSprite'
import type { PixelAvatarConfig } from '../lib/pixelAvatar/types'
import { supabase } from '../lib/supabaseClient'

export function PlayerFighterPage() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, profile: authProfile, loading: authLoading, refreshProfile } = useAuth()
  const loadedProfileIdRef = useRef<string | null>(null)
  const [resolved, setResolved] = useState<Awaited<ReturnType<typeof resolvePlayerProfile>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [showdownEnabled, setShowdownEnabled] = useState(false)
  const [pixelConfig, setPixelConfig] = useState<PixelAvatarConfig>(() => defaultPixelAvatarConfig())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!playerId) {
      setResolved(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void resolvePlayerProfile(playerId).then((result) => {
      if (!cancelled) {
        setResolved(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [playerId])

  const editableProfile = useMemo(() => {
    if (authProfile && (authProfile.id === playerId || authProfile.id === resolved?.profile?.id)) {
      return authProfile
    }
    if (authProfile?.is_admin && resolved?.profile) return resolved.profile
    return null
  }, [authProfile, playerId, resolved?.profile])

  useEffect(() => {
    if (!editableProfile) return
    if (loadedProfileIdRef.current === editableProfile.id) return
    loadedProfileIdRef.current = editableProfile.id
    const config = normalizePixelAvatarConfig(editableProfile.pixel_avatar)
    setShowdownEnabled(Boolean(config))
    setPixelConfig(config ?? defaultPixelAvatarConfig())
  }, [editableProfile])

  const previewSrc = showdownEnabled
    ? resolveGameSpriteForCharacter(pixelConfig.characterId, 'stance')
    : null

  const backToProfile = () => {
    if (playerId) navigate(`/players/${playerId}`)
    else navigate('/profile')
  }

  const save = async () => {
    if (!editableProfile) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('profiles')
      .update({ pixel_avatar: showdownEnabled ? pixelConfig : null })
      .eq('id', editableProfile.id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    window.dispatchEvent(new Event('successpadel:profile-synced'))
    if (user?.id === editableProfile.id) void refreshProfile()
    backToProfile()
  }

  if (!playerId) return <Navigate to="/profile" replace />

  const waiting = loading || authLoading || (user && !authProfile)

  return (
    <div className="game-bg flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <AppTopBar>
        <button
          type="button"
          onClick={backToProfile}
          className="text-sm font-medium text-brand-accent md:text-base"
        >
          {t('common.back')}
        </button>
      </AppTopBar>
      <main data-scroll-y className="scroll-y min-h-0 min-w-0 flex-1 pb-[calc(var(--app-shell-dock-height)+0.5rem)] pt-2">
        <AppShellColumn fill={false} className="space-y-3 pb-8">
          {waiting ? (
            <p className="py-8 text-center text-sm text-brand-muted">{t('common.loading')}</p>
          ) : !editableProfile ? (
            <div className="game-card px-4 py-6 text-center text-sm text-brand-muted">
              {t('playerProfile.notFound')}
            </div>
          ) : (
            <section className="game-card space-y-4 px-4 py-4 md:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-display text-xl font-bold text-brand-primary">
                    {t('profile.showdownTitle')}
                  </h1>
                  <p className="mt-1 text-xs text-brand-muted">{t('profile.showdownHint')}</p>
                </div>
                <div className="flex h-20 w-20 shrink-0 items-end justify-center rounded-xl border border-brand-border bg-brand-bg-alt/70">
                  {previewSrc ? (
                    <GameLineupSprite src={previewSrc} facing="right" size={72} className="h-[4.5rem] w-[4.5rem]" />
                  ) : (
                    <span className="pb-3 text-xs font-semibold text-brand-muted">
                      {t('profile.showdownNone')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowdownEnabled(false)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    !showdownEnabled
                      ? 'border-brand-accent bg-brand-accent/20 text-brand-accent'
                      : 'border-brand-border text-brand-muted'
                  }`}
                >
                  {t('profile.showdownNone')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowdownEnabled(true)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    showdownEnabled
                      ? 'border-brand-accent bg-brand-accent/20 text-brand-accent'
                      : 'border-brand-border text-brand-muted'
                  }`}
                >
                  {t('profile.showdownPick')}
                </button>
              </div>

              {showdownEnabled ? (
                <PixelAvatarEditor config={pixelConfig} onChange={setPixelConfig} />
              ) : null}

              <div className="space-y-2 rounded-xl border border-brand-border bg-brand-bg-alt p-3 shadow-sm dark:bg-white/[0.06] dark:shadow-none">
                {error ? <p className="text-xs text-red-600 dark:text-red-300">{error}</p> : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="brand-btn w-full py-2.5 text-sm font-semibold"
                >
                  {busy ? t('common.loading') : t('playerProfile.save')}
                </button>
              </div>
            </section>
          )}
        </AppShellColumn>
      </main>
    </div>
  )
}
