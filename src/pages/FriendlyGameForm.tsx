import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconSave,
} from '../components/ButtonIcons'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { SetupCard } from '../components/setup/SetupCard'
import { SessionSetupControls } from '../components/setup/SessionSetupControls'
import { MemberPlayerSlots, type PadelPlayerOption } from '../components/setup/MemberPlayerSlots'
import { useAuth } from '../hooks/useAuth'
import { useFriendlyFormDraft } from '../hooks/useFriendlyFormDraft'
import { useFriendlyGame } from '../hooks/useFriendlyGame'
import { useTranslation } from '../hooks/useTranslation'
import {
  clubTimePartsFromDate,
  formatHourLabel,
  normalizeClubDateInput,
} from '../lib/courtSchedule'
import {
  buildCompetitionAutoTitle,
  GENDERS,
  SKILL_LEVELS,
  type Gender,
  type SkillLevel,
} from '../lib/competitionPresets'
import {
  COURT_COUNT_OPTIONS,
  courtCountFromPlayers,
  playersFromCourtCount,
  type CourtCount,
} from '../lib/competitionLayout'
import {
  friendlyFormDefaults,
  friendlyFormInitialState,
  friendlyFormValuesFromGame,
} from '../lib/friendlyFormDraft'
import {
  clearFriendlyGamesCache,
  canEditFriendlySession,
  friendlyConfigWithSessionEnd,
  friendlyStartsAtIso,
  friendlySessionEndAt,
  mergeFriendlyOrganizedConfig,
  type FriendlyOrganizedConfig,
  type FriendlyPlayMode,
  type FriendlyVisibility,
} from '../lib/friendlyGames'
import { GAME_SETUP_MIN_BREAK_MINUTES } from '../lib/gameSchedule'
import { publishFriendlySession, updateFriendlySession } from '../lib/friendlyServer'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'

function parseTimeInput(value: string, fallbackHour: number, fallbackMinute: number) {
  const [hourRaw, minuteRaw] = value.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: fallbackHour, minute: fallbackMinute }
  }
  return {
    hour: Math.max(0, Math.min(23, Math.floor(hour))),
    minute: Math.max(0, Math.min(59, Math.floor(minute))),
  }
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute
}

function windowMinutesBetween(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): number {
  const start = minutesOfDay(startHour, startMinute)
  let end = minutesOfDay(endHour, endMinute)
  if (end <= start) end += 24 * 60
  return end - start
}

function padArray<T>(values: T[], count: number, fill: T): T[] {
  const next = values.slice(0, count)
  while (next.length < count) next.push(fill)
  return next
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
  const [courtCount, setCourtCount] = useState<CourtCount>(() =>
    courtCountFromPlayers(initial.playerSlots.length),
  )
  const [visibility, setVisibility] = useState<FriendlyVisibility>(initial.visibility)
  const [playMode, setPlayMode] = useState<FriendlyPlayMode>(initial.playMode)
  const [previewSeed, setPreviewSeed] = useState(initial.previewSeed)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(!isEdit)
  const [rulesSetup, setRulesSetup] = useState(() => ({
    ...initial.rulesSetup,
    breakMinutes: Math.max(GAME_SETUP_MIN_BREAK_MINUTES, initial.rulesSetup.breakMinutes),
  }))

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
      rulesSetup,
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
      rulesSetup,
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
    setCourtCount(courtCountFromPlayers(values.playerSlots.length))
    setVisibility(values.visibility)
    setPlayMode(values.playMode)
    setSkillLevel(values.skillLevel)
    setGender(values.gender)
    setRulesSetup({
      ...values.rulesSetup,
      breakMinutes: Math.max(GAME_SETUP_MIN_BREAK_MINUTES, values.rulesSetup.breakMinutes),
    })
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

  const trimmedSlots = useMemo(() => playerSlots.map((s) => s.trim()), [playerSlots])

  const applyCourtCount = useCallback((count: CourtCount) => {
    const players = playersFromCourtCount(count)
    setCourtCount(count)
    setPlayerSlots((prev) => padArray(prev, players, ''))
    setProfileIds((prev) => padArray(prev, players, null))
    setPadelPlayerIds((prev) => padArray(prev, players, null))
  }, [])

  const profileAvatars = useMemo(
    () =>
      profileIds.map((id) =>
        id ? (profiles.find((p) => p.id === id)?.avatar_url ?? null) : null,
      ),
    [profileIds, profiles],
  )

  const organizedConfig = useMemo(
    (): FriendlyOrganizedConfig => ({
      day,
      startHour,
      startMinute,
      ...rulesSetup,
      breakMinutes: Math.max(GAME_SETUP_MIN_BREAK_MINUTES, rulesSetup.breakMinutes),
      previewSeed,
      skillLevel,
      gender,
    }),
    [day, startHour, startMinute, rulesSetup, previewSeed, skillLevel, gender],
  )

  const sessionEndParts = useMemo(() => {
    const endAt = friendlySessionEndAt(organizedConfig)
    if (!endAt) return { hour: startHour, minute: startMinute }
    return clubTimePartsFromDate(endAt)
  }, [organizedConfig, startHour, startMinute])

  const scheduleWindowMinutes = useMemo(
    () =>
      windowMinutesBetween(
        startHour,
        startMinute,
        sessionEndParts.hour,
        sessionEndParts.minute,
      ),
    [sessionEndParts.hour, sessionEndParts.minute, startHour, startMinute],
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

  const handlePlayersChange = (
    names: string[],
    ids: (string | null)[],
    padelIds: (string | null)[],
  ) => {
    setPlayerSlots(names)
    setProfileIds(ids)
    setPadelPlayerIds(padelIds)
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

    const publishDay = normalizeClubDateInput(day)
    const publishOrganizedConfig =
      playMode === 'organized'
        ? mergeFriendlyOrganizedConfig(
            game?.organizedConfig,
            friendlyConfigWithSessionEnd({ ...organizedConfig, day: publishDay }),
          )
        : undefined
    const publishStartsAt = publishOrganizedConfig
      ? friendlyStartsAtIso(publishOrganizedConfig)
      : undefined
    const publishTitle =
      playMode === 'organized' && !titleEdited && publishStartsAt
        ? buildCompetitionAutoTitle(skillLevel, gender, new Date(publishStartsAt))
        : title.trim() || 'Friendly match'

    const payload = {
      title: publishTitle,
      players: trimmedSlots,
      profileIds,
      profileAvatars,
      playMode,
      visibility,
      organizedConfig: publishOrganizedConfig,
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

  return (
    <div className="w-full space-y-3 pb-[calc(var(--app-shell-dock-height)+2rem)]">
      <SetupCard
        onBlur={isEdit ? undefined : persistNow}
        header={
          isEdit ? (
            <p className="min-w-0 truncate text-sm font-semibold text-brand-primary">
              {t('friendly.editTitle')}
            </p>
          ) : undefined
        }
      >
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
          <SessionSetupControls
            formatLabel={t('competition.formatLabel')}
            playerMode="singles"
            playerModeOptions={[
              { value: 'singles', label: t('competition.formatSingles') },
              { value: 'duos', label: t('competition.formatDuos'), disabled: true },
            ]}
            onPlayerModeChange={() => undefined}
            courtsLabel={t('competition.courts')}
            courtCount={courtCount}
            courtOptions={COURT_COUNT_OPTIONS}
            onCourtCountChange={applyCourtCount}
            schedule={{
              value: {
                gameCount: rulesSetup.gameCount,
                gameMinutes: rulesSetup.gameMinutes,
                breakMinutes: Math.max(GAME_SETUP_MIN_BREAK_MINUTES, rulesSetup.breakMinutes),
              },
              dateValue: day,
              onDateChange: setDay,
              startValue: formatHourLabel(startHour, startMinute),
              endValue: formatHourLabel(sessionEndParts.hour, sessionEndParts.minute),
              windowMinutes: scheduleWindowMinutes,
              onStartChange: (value) => {
                const { hour, minute } = parseTimeInput(value, startHour, startMinute)
                setStartHour(hour)
                setStartMinute(minute)
              },
              onEndChange: (value) => {
                const { hour, minute } = parseTimeInput(
                  value,
                  sessionEndParts.hour,
                  sessionEndParts.minute,
                )
                setRulesSetup((prev) => ({
                  ...prev,
                  sessionEndHour: hour,
                  sessionEndMinute: minute,
                }))
              },
              onChange: (patch) => {
                setRulesSetup((prev) => ({
                  ...prev,
                  ...patch,
                  breakMinutes: Math.max(
                    GAME_SETUP_MIN_BREAK_MINUTES,
                    patch.breakMinutes ?? prev.breakMinutes,
                  ),
                }))
              },
            }}
            levelLabel="Level"
            skillLevels={SKILL_LEVELS}
            skillLevel={skillLevel}
            onSkillLevelChange={setSkillLevel}
            genderLabel="Gender"
            genders={GENDERS}
            gender={gender}
            onGenderChange={setGender}
            titleLabel="Title"
            title={title}
            titlePlaceholder={autoTitle}
            onTitleChange={(value) => {
              setTitle(value)
              setTitleEdited(true)
            }}
            onTitleBlur={isEdit ? undefined : persistNow}
          />
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
            disabled={busy}
            showMembers={isAdmin}
            showPlayerProfiles
          />
        </div>

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
      </SetupCard>
    </div>
  )
}
