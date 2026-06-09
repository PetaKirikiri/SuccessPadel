import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CompetitionLayoutPreview } from '../components/CompetitionLayoutPreview'
import {
  CompetitionRulesSetup,
  type CompetitionRulesSetupValues,
} from '../components/CompetitionRulesSetup'
import { MemberPlayerSlots } from '../components/MemberPlayerSlots'
import { SessionTimeSetup } from '../components/SessionTimeSetup'
import { useAuth } from '../hooks/useAuth'
import { useFriendlyFormDraft } from '../hooks/useFriendlyFormDraft'
import { useTranslation } from '../hooks/useTranslation'
import { friendlyFormInitialState } from '../lib/friendlyFormDraft'
import {
  clearFriendlyGamesCache,
  FRIENDLY_MAX_PLAYERS,
  friendlyOrganizedGames,
  friendlyOrganizedSession,
  friendlyStartsAtIso,
  type FriendlyOrganizedConfig,
  type FriendlyPlayMode,
  type FriendlyVisibility,
} from '../lib/friendlyGames'
import { publishFriendlySession } from '../lib/friendlyServer'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

export function FriendlyGameForm() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile, user, session, loading: authLoading } = useAuth()
  const initial = useMemo(() => friendlyFormInitialState(), [])
  const [title, setTitle] = useState(initial.title)
  const [day, setDay] = useState(initial.day)
  const [startHour, setStartHour] = useState(initial.startHour)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [playerSlots, setPlayerSlots] = useState(initial.playerSlots)
  const [profileIds, setProfileIds] = useState(initial.profileIds)
  const [visibility, setVisibility] = useState<FriendlyVisibility>(initial.visibility)
  const [playMode, setPlayMode] = useState<FriendlyPlayMode>(initial.playMode)
  const [rulesSetup, setRulesSetup] = useState<CompetitionRulesSetupValues>(initial.rulesSetup)
  const [previewSeed, setPreviewSeed] = useState(initial.previewSeed)
  const [courtNames, setCourtNames] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const draftValues = useMemo(
    () => ({
      title,
      visibility,
      day,
      startHour,
      playerSlots,
      profileIds,
      playMode,
      rulesSetup,
      previewSeed,
    }),
    [title, visibility, day, startHour, playerSlots, profileIds, playMode, rulesSetup, previewSeed],
  )

  const { persistNow, clearDraft } = useFriendlyFormDraft({ values: draftValues })

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .order('display_name')
      .then(({ data }) => setProfiles((data as Profile[]) ?? []))
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('list_setup_courts')
      if (active && Array.isArray(data)) {
        setCourtNames(
          (data as { name: string; sort_order: number }[])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => c.name),
        )
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const trimmedSlots = useMemo(() => playerSlots.map((s) => s.trim()), [playerSlots])

  const profileAvatars = useMemo(
    () =>
      profileIds.map((id) =>
        id ? (profiles.find((p) => p.id === id)?.avatar_url ?? null) : null,
      ),
    [profileIds, profiles],
  )

  const organizedConfig = useMemo(
    (): FriendlyOrganizedConfig => ({ day, startHour, ...rulesSetup, previewSeed }),
    [day, startHour, rulesSetup, previewSeed],
  )

  const startsAtIso = useMemo(
    () => friendlyStartsAtIso(organizedConfig),
    [organizedConfig],
  )

  const previewSession = useMemo(
    () => friendlyOrganizedSession(organizedConfig),
    [organizedConfig],
  )

  const previewGames = useMemo(
    () => friendlyOrganizedGames(trimmedSlots, organizedConfig, courtNames),
    [trimmedSlots, organizedConfig, courtNames],
  )

  const handlePlayersChange = (names: string[], ids: (string | null)[]) => {
    setPlayerSlots(names)
    setProfileIds(ids)
  }

  const addPlayerSlot = () => {
    if (playerSlots.length >= FRIENDLY_MAX_PLAYERS) return
    setPlayerSlots((prev) => [...prev, ''])
    setProfileIds((prev) => [...prev, null])
  }

  const accept = async () => {
    if (authLoading) return
    if (!user || !session) {
      setError(t('friendly.signInRequired'))
      return
    }
    setBusy(true)
    setError(null)
    const { data: live } = await supabase.auth.getSession()
    if (!live.session) {
      setError(t('friendly.signInRequired'))
      setBusy(false)
      return
    }
    const { id: serverId, error: publishError } = await publishFriendlySession({
      title: title.trim() || 'Friendly match',
      players: trimmedSlots,
      profileIds,
      profileAvatars,
      playMode,
      visibility,
      organizedConfig: playMode === 'organized' ? organizedConfig : undefined,
      status: 'ready',
    })
    if (!serverId) {
      setError(publishError ?? t('friendly.publishFailed'))
      setBusy(false)
      return
    }
    clearDraft()
    clearFriendlyGamesCache()
    setBusy(false)
    navigate(
      playMode === 'free' && visibility === 'private' && profile?.is_admin
        ? `/friendly/${serverId}/pad`
        : `/friendly/${serverId}`,
    )
  }

  return (
    <div className="w-full min-w-0 space-y-3 pb-4">
      <Link to="/friendly" className="text-sm font-medium text-brand-accent">
        ← {t('common.back')}
      </Link>

      <section className="game-card space-y-3" onBlur={persistNow}>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {t('friendly.nameLabel')}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={persistNow}
            placeholder={t('friendly.namePlaceholder')}
            className="brand-input"
          />
        </label>

        <div className="grid grid-cols-2 gap-2 border-t border-brand-border/40 pt-2">
          <button
            type="button"
            onClick={() => setVisibility('public')}
            className={`game-tab game-tab-competition py-2.5 ${visibility === 'public' ? 'game-tab-selected' : ''}`}
          >
            {t('friendly.public')}
          </button>
          <button
            type="button"
            onClick={() => setVisibility('private')}
            className={`game-tab game-tab-competition py-2.5 ${visibility === 'private' ? 'game-tab-selected' : ''}`}
          >
            {t('friendly.private')}
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {t('friendly.playerNames')}
          </p>
          <MemberPlayerSlots
            count={playerSlots.length}
            profiles={profiles}
            names={playerSlots}
            profileIds={profileIds}
            onChange={handlePlayersChange}
            onAdd={addPlayerSlot}
            canAdd={playerSlots.length < FRIENDLY_MAX_PLAYERS}
            addLabel={t('friendly.addPlayerSlot')}
            disabled={busy}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlayMode('free')}
              className={`game-tab game-tab-competition py-2.5 ${playMode === 'free' ? 'game-tab-selected' : ''}`}
            >
              {t('friendly.freePlay')}
            </button>
            <button
              type="button"
              onClick={() => setPlayMode('organized')}
              className={`game-tab game-tab-competition py-2.5 ${playMode === 'organized' ? 'game-tab-selected' : ''}`}
            >
              {t('friendly.organizedPlay')}
            </button>
          </div>
        </div>

        {playMode === 'organized' ? (
          <>
            <div className="border-t border-brand-border/40 pt-3" />
            <SessionTimeSetup
              day={day}
              startHour={startHour}
              onDayChange={setDay}
              onStartHourChange={setStartHour}
              onBlur={persistNow}
            />
            <CompetitionRulesSetup
              value={rulesSetup}
              onChange={(patch) => setRulesSetup((prev) => ({ ...prev, ...patch }))}
            />
            {rulesSetup.ruleFormat === 'americano' && (
              <>
                {previewGames && previewGames.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-brand-border/60">
                    <CompetitionLayoutPreview
                      session={previewSession}
                      games={previewGames}
                      eventStartsAt={startsAtIso}
                      gameMinutes={rulesSetup.gameMinutes}
                    />
                  </div>
                ) : courtNames.length === 0 ? (
                  <p className="text-xs text-brand-muted">Loading courts…</p>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPreviewSeed((s) => s + 1)}
                  className="brand-btn-outline w-full py-2 text-sm font-semibold"
                >
                  Shuffle match-ups
                </button>
              </>
            )}
          </>
        ) : null}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void accept()}
          className="brand-btn w-full py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy
            ? t('common.loading')
            : playMode === 'free'
              ? t('friendly.startMatch')
              : t('friendly.accept')}
        </button>
      </section>
    </div>
  )
}
