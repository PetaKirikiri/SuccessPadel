import { useEffect, useMemo, useState } from 'react'
import {
  IconFreePlay,
  IconOrganized,
  IconPrivate,
  IconPublic,
  IconSave,
  IconShuffle,
} from '../components/ButtonIcons'
import { shellTabClass } from '../components/ShellTabIcons'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CompetitionLayoutPreview } from '../components/CompetitionLayoutPreview'
import { FriendlyRuleSettings } from '../components/FriendlyRuleSettings'
import { MemberPlayerSlots, type PadelPlayerOption } from '../components/MemberPlayerSlots'
import { useAuth } from '../hooks/useAuth'
import { useFriendlyFormDraft } from '../hooks/useFriendlyFormDraft'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useTranslation } from '../hooks/useTranslation'
import {
  clubTimeSlotValue,
  parseClubTimeSlotValue,
  scheduleHalfHourSlots,
} from '../lib/courtSchedule'
import { lockedCompetitionRuleChips } from '../lib/lockedCompetitionFormat'
import {
  buildCompetitionAutoTitle,
  GENDERS,
  SKILL_LEVELS,
  type Gender,
  type SkillLevel,
} from '../lib/competitionPresets'
import {
  friendlyFormDefaults,
  friendlyFormInitialState,
  friendlyFormValuesFromGame,
} from '../lib/friendlyFormDraft'
import {
  clearFriendlyGamesCache,
  FRIENDLY_MAX_PLAYERS,
  canEditFriendlySession,
  friendlyConfigWithSessionEnd,
  friendlyOrganizedGames,
  friendlyOrganizedSession,
  friendlyStartsAtIso,
  lockedFriendlyOrganizedRules,
  mergeFriendlyOrganizedConfig,
  type FriendlyOrganizedConfig,
  type FriendlyPlayMode,
  type FriendlyVisibility,
} from '../lib/friendlyGames'
import { publishFriendlySession, updateFriendlySession } from '../lib/friendlyServer'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
        active
          ? 'bg-brand-accent text-white shadow-sm'
          : 'border border-brand-border bg-brand-surface text-brand-text'
      }`}
    >
      {children}
    </button>
  )
}

export function FriendlyGameForm() {
  const { id: editId } = useParams()
  const isEdit = Boolean(editId)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile, user, session, loading: authLoading } = useAuth()
  const isAdmin = Boolean(profile?.is_admin)
  const { game, loading: gameLoading } = useFriendlyGame(isEdit ? editId : undefined)
  const initial = useMemo(
    () => (isEdit ? friendlyFormDefaults() : friendlyFormInitialState()),
    [isEdit],
  )
  const [title, setTitle] = useState(initial.title)
  const [titleEdited, setTitleEdited] = useState(isEdit)
  const [day, setDay] = useState(initial.day)
  const [startHour, setStartHour] = useState(initial.startHour)
  const [startMinute, setStartMinute] = useState(initial.startMinute ?? 0)
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(initial.skillLevel)
  const [gender, setGender] = useState<Gender>(initial.gender)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [padelPlayers, setPadelPlayers] = useState<PadelPlayerOption[]>([])
  const [playerSlots, setPlayerSlots] = useState(initial.playerSlots)
  const [profileIds, setProfileIds] = useState(initial.profileIds)
  const [padelPlayerIds, setPadelPlayerIds] = useState<(string | null)[]>(() =>
    initial.profileIds.map(() => null),
  )
  const [visibility, setVisibility] = useState<FriendlyVisibility>(initial.visibility)
  const [playMode, setPlayMode] = useState<FriendlyPlayMode>(initial.playMode)
  const [previewSeed, setPreviewSeed] = useState(initial.previewSeed)
  const [courtNames, setCourtNames] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(!isEdit)
  const lockedRules = useMemo(() => lockedFriendlyOrganizedRules(), [])

  const draftValues = useMemo(
    () => ({
      title,
      visibility,
      day,
      startHour,
      startMinute,
      playerSlots,
      profileIds,
      playMode,
      previewSeed,
      skillLevel,
      gender,
      rulesSetup: lockedRules,
    }),
    [
      title,
      visibility,
      day,
      startHour,
      startMinute,
      playerSlots,
      profileIds,
      playMode,
      previewSeed,
      skillLevel,
      gender,
      lockedRules,
    ],
  )

  const { persistNow, clearDraft } = useFriendlyFormDraft({
    values: draftValues,
    enabled: !isEdit,
  })

  useEffect(() => {
    if (!isEdit || !game || hydrated) return
    const values = friendlyFormValuesFromGame(game)
    setTitle(values.title)
    setDay(values.day)
    setStartHour(values.startHour)
    setStartMinute(values.startMinute)
    setPlayerSlots(values.playerSlots)
    setProfileIds(values.profileIds)
    setPadelPlayerIds(values.profileIds.map(() => null))
    setVisibility(values.visibility)
    setPlayMode(values.playMode)
    setSkillLevel(values.skillLevel)
    setGender(values.gender)
    setPreviewSeed(values.previewSeed)
    setTitleEdited(true)
    setHydrated(true)
  }, [game, hydrated, isEdit])

  useEffect(() => {
    void supabase
      .from('padel_players')
      .select('id, display_name, profile_id')
      .is('profile_id', null)
      .order('display_name')
      .then(({ data }) => setPadelPlayers((data as PadelPlayerOption[]) ?? []))
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      setProfiles([])
      return
    }
    void supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .order('display_name')
      .then(({ data }) => setProfiles((data as Profile[]) ?? []))
  }, [isAdmin])

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

  const halfHourSlots = useMemo(() => scheduleHalfHourSlots(), [])

  const organizedConfig = useMemo(
    (): FriendlyOrganizedConfig => ({
      day,
      startHour,
      startMinute,
      ...lockedRules,
      previewSeed,
      skillLevel,
      gender,
    }),
    [day, startHour, startMinute, lockedRules, previewSeed, skillLevel, gender],
  )

  const startsAtIso = useMemo(
    () => friendlyStartsAtIso(organizedConfig),
    [organizedConfig],
  )

  const autoTitle = useMemo(
    () => buildCompetitionAutoTitle(skillLevel, gender, new Date(startsAtIso ?? Date.now())),
    [skillLevel, gender, startsAtIso],
  )

  useEffect(() => {
    if (playMode === 'organized' && !titleEdited) setTitle(autoTitle)
  }, [autoTitle, playMode, titleEdited])

  const ruleChips = useMemo(() => lockedCompetitionRuleChips(t), [t])

  const previewSession = useMemo(
    () => friendlyOrganizedSession(organizedConfig),
    [organizedConfig],
  )

  const previewGames = useMemo(
    () => friendlyOrganizedGames(trimmedSlots, organizedConfig, courtNames),
    [trimmedSlots, organizedConfig, courtNames],
  )

  const handlePlayersChange = (
    names: string[],
    ids: (string | null)[],
    padelIds: (string | null)[],
  ) => {
    setPlayerSlots(names)
    setProfileIds(ids)
    setPadelPlayerIds(padelIds)
  }

  const addPlayerSlot = () => {
    if (playerSlots.length >= FRIENDLY_MAX_PLAYERS) return
    setPlayerSlots((prev) => [...prev, ''])
    setProfileIds((prev) => [...prev, null])
    setPadelPlayerIds((prev) => [...prev, null])
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

    const payload = {
      title: title.trim() || 'Friendly match',
      players: trimmedSlots,
      profileIds,
      profileAvatars,
      playMode,
      visibility,
      organizedConfig:
        playMode === 'organized'
          ? mergeFriendlyOrganizedConfig(
              game?.organizedConfig,
              friendlyConfigWithSessionEnd(organizedConfig),
            )
          : undefined,
      status: game?.status ?? ('ready' as const),
    }

    if (isEdit && editId) {
      const err = await updateFriendlySession(editId, payload)
      if (err) {
        setError(err)
        setBusy(false)
        return
      }
      setBusy(false)
      navigate(`/friendly/${editId}`)
      return
    }

    const { id: serverId, error: publishError } = await publishFriendlySession(payload)
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

  if (isEdit && (gameLoading || !hydrated)) {
    return <p className="text-sm text-brand-muted">{t('common.loading')}</p>
  }
  if (isEdit && !game) return <Navigate to="/friendly" replace />
  if (isEdit && game && user && !canEditFriendlySession(game, user.id, isAdmin)) {
    return <Navigate to={`/friendly/${editId}`} replace />
  }

  const backTo = isEdit && editId ? `/friendly/${editId}` : '/friendly'

  return (
    <div className="w-full min-w-0 space-y-3 pb-4">
      <Link to={backTo} className="text-sm font-medium text-brand-accent">
        ← {t('common.back')}
      </Link>

      <section className="game-card space-y-3" onBlur={isEdit ? undefined : persistNow}>
        {isEdit ? (
          <p className="text-sm font-semibold text-brand-primary">{t('friendly.editTitle')}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setVisibility('public')}
            className={`${shellTabClass(visibility === 'public', 'competition')} py-2.5`}
          >
            <IconPublic />
            <span>{t('friendly.public')}</span>
          </button>
          <button
            type="button"
            onClick={() => setVisibility('private')}
            className={`${shellTabClass(visibility === 'private', 'competition')} py-2.5`}
          >
            <IconPrivate />
            <span>{t('friendly.private')}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPlayMode('free')}
            className={`${shellTabClass(playMode === 'free', 'competition')} py-2.5`}
          >
            <IconFreePlay />
            <span>{t('friendly.freePlay')}</span>
          </button>
          <button
            type="button"
            onClick={() => setPlayMode('organized')}
            className={`${shellTabClass(playMode === 'organized', 'competition')} py-2.5`}
          >
            <IconOrganized />
            <span>{t('friendly.organizedPlay')}</span>
          </button>
        </div>

        {playMode === 'free' ? (
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              {t('friendly.nameLabel')}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={isEdit ? undefined : persistNow}
              placeholder={t('friendly.namePlaceholder')}
              className="brand-input"
            />
          </label>
        ) : (
          <>
            <FriendlyRuleSettings chips={ruleChips} />
            <div className="grid grid-cols-2 gap-2">
              <label className="block min-w-0 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Day
                </span>
                <input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  onBlur={isEdit ? undefined : persistNow}
                  className="brand-input h-11"
                />
              </label>
              <label className="block min-w-0 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Start
                </span>
                <select
                  value={clubTimeSlotValue(startHour, startMinute)}
                  onChange={(e) => {
                    const { hour, minute } = parseClubTimeSlotValue(e.target.value)
                    setStartHour(hour)
                    setStartMinute(minute)
                  }}
                  onBlur={isEdit ? undefined : persistNow}
                  className="brand-input h-11"
                >
                  {halfHourSlots.map((slot) => (
                    <option key={slot.label} value={slot.label}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Level
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SKILL_LEVELS.map((level) => (
                  <Chip key={level} active={skillLevel === level} onClick={() => setSkillLevel(level)}>
                    {level}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Gender
              </span>
              <div className="flex flex-wrap gap-1.5">
                {GENDERS.map((g) => (
                  <Chip key={g} active={gender === g} onClick={() => setGender(g)}>
                    {g}
                  </Chip>
                ))}
              </div>
            </div>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Title
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setTitleEdited(true)
                }}
                onBlur={isEdit ? undefined : persistNow}
                placeholder={autoTitle}
                className="brand-input"
              />
            </label>
          </>
        )}

        <div className="space-y-3 border-t border-brand-border/40 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {t('friendly.playerNames')}
          </p>
          <MemberPlayerSlots
            count={playerSlots.length}
            profiles={profiles}
            padelPlayers={padelPlayers}
            names={playerSlots}
            profileIds={profileIds}
            padelPlayerIds={padelPlayerIds}
            onChange={handlePlayersChange}
            onAdd={addPlayerSlot}
            canAdd={playerSlots.length < FRIENDLY_MAX_PLAYERS}
            addLabel={t('friendly.addPlayerSlot')}
            disabled={busy}
            showMembers={isAdmin}
            showPlayerProfiles
          />
        </div>

        {playMode === 'organized' ? (
          <>
            {previewGames && previewGames.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-brand-border/60">
                <CompetitionLayoutPreview
                  session={previewSession}
                  games={previewGames}
                  eventStartsAt={startsAtIso}
                  gameMinutes={lockedRules.gameMinutes}
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
              <IconShuffle />
              Shuffle match-ups
            </button>
          </>
        ) : null}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void accept()}
          className="brand-btn w-full py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          <IconSave />
          {busy
            ? t('common.loading')
            : isEdit
              ? t('friendly.saveChanges')
              : playMode === 'free'
                ? t('friendly.startMatch')
                : t('friendly.accept')}
        </button>
      </section>
    </div>
  )
}
