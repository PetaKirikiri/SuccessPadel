import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  clubTimePartsFromDate,
  clubTimeSlotValue,
  formatDateInput,
  parseClubTimeSlotValue,
  scheduleHalfHourSlots,
  snapToHalfHour,
  toIsoTimestamp,
} from '../lib/courtSchedule'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionFormDraft } from '../hooks/useCompetitionFormDraft'
import { type CompetitionFormDraft } from '../lib/competitionFormDraft'
import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { MemberPlayerSlots, type PadelPlayerOption } from '../components/MemberPlayerSlots'
import { FriendlyRuleSettings } from '../components/FriendlyRuleSettings'
import { useTranslation } from '../hooks/useTranslation'
import { measureScheduleQuality, solveBalancedSchedule } from '../lib/balancedSchedule'
import {
  buildStoredSchedule,
  RANKED_SCHEDULE_VERSION,
  sortRosterByRank,
} from '../lib/rankedSchedule'
import {
  LOCKED_COMPETITION,
  lockedCompetitionEventMinutes,
  lockedCompetitionRuleChips,
  lockedCompetitionScoringConfig,
  lockedCompetitionSessionFields,
} from '../lib/lockedCompetitionFormat'
import { buildCompetitionAutoTitle, GENDERS, SKILL_LEVELS, type Gender, type SkillLevel } from '../lib/competitionPresets'
import { buildCompetitionRosterSlots } from '../lib/competitionRosterSlots'
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

function bangkokDateFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(iso))
}

function padArray<T>(values: T[], count: number, fill: T): T[] {
  const next = values.slice(0, count)
  while (next.length < count) next.push(fill)
  return next
}

function flushPendingInputs(): Promise<void> {
  return new Promise((resolve) => {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
    window.setTimeout(() => resolve(), 160)
  })
}

export function CompetitionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [day, setDay] = useState(formatDateInput(new Date()))
  const [startHour, setStartHour] = useState(18)
  const [startMinute, setStartMinute] = useState(0)
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('Low Inter')
  const [gender, setGender] = useState<Gender>('Mixed')
  const [title, setTitle] = useState('')
  const [titleEdited, setTitleEdited] = useState(Boolean(id))
  const [seasonId, setSeasonId] = useState('')
  const [seasonLoading, setSeasonLoading] = useState(true)
  const [seasonError, setSeasonError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playerSlots, setPlayerSlots] = useState<string[]>(() =>
    Array(LOCKED_COMPETITION.targetPlayers).fill(''),
  )
  const [profileIds, setProfileIds] = useState<(string | null)[]>(() =>
    Array(LOCKED_COMPETITION.targetPlayers).fill(null),
  )
  const [padelPlayerIds, setPadelPlayerIds] = useState<(string | null)[]>(() =>
    Array(LOCKED_COMPETITION.targetPlayers).fill(null),
  )
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [padelPlayers, setPadelPlayers] = useState<PadelPlayerOption[]>([])
  const [previewSeed, setPreviewSeed] = useState(0)
  const [slotCount, setSlotCount] = useState(LOCKED_COMPETITION.targetPlayers)
  const [competitionStarted, setCompetitionStarted] = useState(false)
  const [rosterHydrated, setRosterHydrated] = useState(!id)

  const draftScope = id ?? 'new'
  const applyDraft = useCallback((draft: CompetitionFormDraft) => {
    setDay(draft.day)
    setStartHour(draft.startHour)
    setStartMinute(draft.startMinute === 30 ? 30 : 0)
    if (SKILL_LEVELS.includes(draft.skillLevel as SkillLevel)) {
      setSkillLevel(draft.skillLevel as SkillLevel)
    }
    if (GENDERS.includes(draft.gender as Gender)) {
      setGender(draft.gender as Gender)
    }
    setTitle(draft.title)
    setTitleEdited(draft.titleEdited)
    setPreviewSeed(draft.previewSeed)
    const slots = Array(LOCKED_COMPETITION.targetPlayers).fill('')
    for (let i = 0; i < Math.min(draft.playerSlots.length, LOCKED_COMPETITION.targetPlayers); i += 1) {
      slots[i] = draft.playerSlots[i] ?? ''
    }
    setPlayerSlots(slots)
  }, [])

  const draftValues = useMemo(
    (): Omit<CompetitionFormDraft, 'v' | 'savedAt'> => ({
      day,
      startHour,
      startMinute,
      skillLevel,
      gender,
      title,
      titleEdited,
      playerSlots,
      previewSeed,
    }),
    [day, startHour, startMinute, skillLevel, gender, title, titleEdited, playerSlots, previewSeed],
  )

  const { clearDraft } = useCompetitionFormDraft({
      scope: draftScope,
      restore: !id,
      persist: !id,
      values: draftValues,
      onRestore: applyDraft,
    })

  const halfHourSlots = useMemo(() => scheduleHalfHourSlots(), [])
  const startsAtIso = useMemo(
    () => toIsoTimestamp(day, startHour, startMinute),
    [day, startHour, startMinute],
  )
  const autoTitle = useMemo(
    () => buildCompetitionAutoTitle(skillLevel, gender, new Date(startsAtIso)),
    [skillLevel, gender, startsAtIso],
  )

  useEffect(() => {
    if (!titleEdited) setTitle(autoTitle)
  }, [autoTitle, titleEdited])
  const trimmedSlots = useMemo(
    () => padArray(playerSlots, slotCount, '').map((s) => s.trim()),
    [playerSlots, slotCount],
  )
  const filledNameCount = useMemo(() => trimmedSlots.filter(Boolean).length, [trimmedSlots])
  const canBuildSchedule =
    filledNameCount >= 4 && filledNameCount % 4 === 0

  useEffect(() => {
    void Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').order('display_name'),
      supabase
        .from('padel_players')
        .select('id, display_name, profile_id')
        .is('profile_id', null)
        .order('display_name'),
    ]).then(([profilesRes, playersRes]) => {
      setProfiles((profilesRes.data as Profile[]) ?? [])
      setPadelPlayers((playersRes.data as PadelPlayerOption[]) ?? [])
    })
  }, [])

  const handlePlayersChange = (
    names: string[],
    ids: (string | null)[],
    padelIds: (string | null)[],
  ) => {
    setPlayerSlots(names)
    setProfileIds(ids)
    setPadelPlayerIds(padelIds)
  }

  useEffect(() => {
    setSeasonLoading(true)
    setSeasonError(null)
    void supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error: seasonQueryError }) => {
        if (seasonQueryError) {
          setSeasonError(seasonQueryError.message)
        } else if (!data?.id) {
          setSeasonError('No active season.')
        } else {
          setSeasonId(data.id)
        }
        setSeasonLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!id) return
    setRosterHydrated(false)
    void (async () => {
      const { data, error: sessionErr } = await supabase
        .from('game_sessions')
        .select('*, scoring_config')
        .eq('id', id)
        .single()

      if (sessionErr || !data) {
        setRosterHydrated(true)
        if (sessionErr) setError(sessionErr.message)
        return
      }

      const target =
        data.target_players ?? data.max_players ?? LOCKED_COMPETITION.targetPlayers
      setSlotCount(target)
      setCompetitionStarted(Boolean(data.competition_started_at))
      if (data.season_id) setSeasonId(data.season_id)
      if (data.skill_level && SKILL_LEVELS.includes(data.skill_level as SkillLevel)) {
        setSkillLevel(data.skill_level as SkillLevel)
      }
      if (data.gender && GENDERS.includes(data.gender as Gender)) {
        setGender(data.gender as Gender)
      }
      setTitle(data.title)
      setTitleEdited(true)
      const config = data.scoring_config as { schedule_seed?: number } | null
      if (typeof config?.schedule_seed === 'number') {
        setPreviewSeed(config.schedule_seed)
      }
      if (data.starts_at) {
        setDay(bangkokDateFromIso(data.starts_at))
        const parts = clubTimePartsFromDate(new Date(data.starts_at))
        const snapped = snapToHalfHour(parts.hour, parts.minute)
        const slots = scheduleHalfHourSlots()
        const match =
          slots.find((s) => s.hour === snapped.hour && s.minute === snapped.minute) ??
          slots.find((s) => s.hour === snapped.hour) ??
          slots[0]
        if (match) {
          setStartHour(match.hour)
          setStartMinute(match.minute)
        }
      } else if (data.starts_on) {
        setDay(data.starts_on)
      }

      const { data: rosterRows, error: rosterErr } = await supabase
        .from('session_players')
        .select('guest_name, rank_order, profile_id, padel_player_id, profiles(display_name)')
        .eq('session_id', id)
        .order('rank_order')

      if (rosterErr) {
        setError(rosterErr.message)
        setRosterHydrated(true)
        return
      }

      const nextNames = Array(target).fill('')
      const nextIds = Array<string | null>(target).fill(null)
      const nextPadelIds = Array<string | null>(target).fill(null)
      const padelIdsOnRoster = new Set<string>()

      for (const row of rosterRows ?? []) {
        const r = row as unknown as {
          guest_name: string | null
          rank_order: number | null
          profile_id: string | null
          padel_player_id: string | null
          profiles: { display_name: string } | null
        }
        const idx = r.rank_order ?? 0
        if (idx >= 0 && idx < nextNames.length) {
          nextNames[idx] = r.profiles?.display_name ?? r.guest_name ?? ''
          nextIds[idx] = r.profile_id
          nextPadelIds[idx] = r.padel_player_id
          if (r.padel_player_id) padelIdsOnRoster.add(r.padel_player_id)
        }
      }

      setPlayerSlots(nextNames)
      setProfileIds(nextIds)
      setPadelPlayerIds(nextPadelIds)

      if (padelIdsOnRoster.size > 0) {
        const { data: rosterPadel } = await supabase
          .from('padel_players')
          .select('id, display_name, profile_id')
          .in('id', [...padelIdsOnRoster])
        if (rosterPadel?.length) {
          setPadelPlayers((prev) => {
            const byId = new Map(prev.map((p) => [p.id, p]))
            for (const row of rosterPadel as PadelPlayerOption[]) {
              if (!row.profile_id) byId.set(row.id, row)
            }
            return [...byId.values()].sort((a, b) =>
              a.display_name.localeCompare(b.display_name),
            )
          })
        }
      }

      setRosterHydrated(true)
    })()
  }, [id])

  const save = async () => {
    await flushPendingInputs()

    if (!seasonId) {
      setError('No active season.')
      return
    }
    const rosterPayload = buildCompetitionRosterSlots(
      trimmedSlots,
      profileIds,
      padelPlayerIds,
    ).filter((slot) => slot.name)
    const playerCount = rosterPayload.length
    if (!id && playerCount !== LOCKED_COMPETITION.targetPlayers) {
      setError('Enter every player name.')
      return
    }
    if (playerCount < 4 || playerCount % 4 !== 0) {
      setError('Could not build match-ups.')
      return
    }
    const scheduleRounds = solveBalancedSchedule(
      playerCount,
      LOCKED_COMPETITION.gameCount,
      previewSeed,
    )
    if (!scheduleRounds.length) {
      setError('Could not build match-ups.')
      return
    }
    setBusy(true)
    setError(null)

    const startsAt = new Date(startsAtIso)
    const eventMinutes = lockedCompetitionEventMinutes()
    const endsAt = new Date(startsAt.getTime() + eventMinutes * 60 * 1000)
    const finalTitle = title.trim() || autoTitle
    const americanoConfig = lockedCompetitionScoringConfig()

    const lockedFields = lockedCompetitionSessionFields({ skillLevel, gender })
    const sessionFields = {
      season_id: seasonId,
      title: finalTitle,
      starts_on: day,
      ends_on: bangkokDateFromIso(endsAt.toISOString()),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      game_kind: 'competition' as const,
      visibility: 'open' as const,
      created_by: user?.id ?? null,
      ...lockedFields,
      target_players: playerCount,
      max_players: playerCount,
    }
    const payload = id
      ? sessionFields
      : { ...sessionFields, status: 'open' as const }

    let sessionId = id
    if (id) {
      const { error: err } = await supabase.from('game_sessions').update(payload).eq('id', id)
      if (err) {
        setBusy(false)
        setError(err.message)
        return
      }
    } else {
      const { data, error: err } = await supabase
        .from('game_sessions')
        .insert(payload)
        .select('id')
        .single()
      if (err || !data) {
        setBusy(false)
        setError(err?.message ?? 'Could not create competition')
        return
      }
      sessionId = data.id
    }

    const { error: rosterErr } = await supabase.rpc('sync_competition_roster_slots', {
      p_session_id: sessionId,
      p_slots: rosterPayload,
    })
    if (rosterErr) {
      setBusy(false)
      setError(rosterErr.message)
      return
    }

    const { data: rosterRows, error: rosterLoadErr } = await supabase
      .from('session_players')
      .select('id, guest_name, rank_order, profile_id, profiles(display_name)')
      .eq('session_id', sessionId)
      .order('rank_order')
    if (rosterLoadErr || !rosterRows?.length) {
      setBusy(false)
      setError(rosterLoadErr?.message ?? 'Could not load roster')
      return
    }
    const ranked = sortRosterByRank(rosterRows as unknown as CompetitionPlayer[])
    const schedule = buildStoredSchedule(
      ranked,
      solveBalancedSchedule(ranked.length, LOCKED_COMPETITION.gameCount, previewSeed),
    )
    const nextConfig = {
      ...americanoConfig,
      schedule_seed: previewSeed,
      schedule_version: RANKED_SCHEDULE_VERSION,
      schedule,
    }
    const { error: cfgErr } = await supabase.rpc('save_competition_scoring_config', {
      p_session_id: sessionId,
      p_scoring_config: nextConfig,
    })
    if (cfgErr) {
      setBusy(false)
      setError(cfgErr.message)
      return
    }

    if (competitionStarted) {
      const { error: rebuildErr } = await supabase.rpc('rebuild_competition_schedule', {
        p_session_id: sessionId,
      })
      if (rebuildErr) {
        setBusy(false)
        setError(rebuildErr.message)
        return
      }
    }

    clearDraft()
    setBusy(false)
    navigate(id ? `/competitions/${sessionId}/run` : '/competitive')
  }

  const saveDisabled =
    busy || (Boolean(id) && !rosterHydrated) || (!id && seasonLoading)
  const scheduleQuality = useMemo(() => {
    if (!canBuildSchedule) return null
    const rounds = solveBalancedSchedule(
      filledNameCount,
      LOCKED_COMPETITION.gameCount,
      previewSeed,
    )
    return measureScheduleQuality(rounds, filledNameCount)
  }, [previewSeed, filledNameCount, canBuildSchedule])
  const ruleChips = useMemo(() => lockedCompetitionRuleChips(t), [t])

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div data-scroll-y className="scroll-y min-h-0 flex-1 space-y-3 pb-6">
        <Link to="/competitive" className="text-sm font-medium text-brand-accent">
          ← Back
        </Link>

        <section className="game-card space-y-3">
          <FriendlyRuleSettings chips={ruleChips} />

          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Day</span>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="brand-input h-11"
              />
            </label>

            <label className="block min-w-0 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Start</span>
              <select
                value={clubTimeSlotValue(startHour, startMinute)}
                onChange={(e) => {
                  const { hour, minute } = parseClubTimeSlotValue(e.target.value)
                  setStartHour(hour)
                  setStartMinute(minute)
                }}
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
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Level</span>
            <div className="flex flex-wrap gap-1.5">
              {SKILL_LEVELS.map((level) => (
                <Chip key={level} active={skillLevel === level} onClick={() => setSkillLevel(level)}>
                  {level}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Gender</span>
            <div className="flex flex-wrap gap-1.5">
              {GENDERS.map((g) => (
                <Chip key={g} active={gender === g} onClick={() => setGender(g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setTitleEdited(true)
              }}
              placeholder={autoTitle}
              className="brand-input"
            />
          </label>

          <div className="border-t border-brand-border/40 pt-3" />

          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            Player names
          </p>
          {!rosterHydrated && id ? (
            <p className="text-sm text-brand-muted">{t('common.loading')}</p>
          ) : (
            <MemberPlayerSlots
              count={slotCount}
              profiles={profiles}
              padelPlayers={padelPlayers}
              names={playerSlots}
              profileIds={profileIds}
              padelPlayerIds={padelPlayerIds}
              onChange={handlePlayersChange}
              disabled={busy}
              showMembers
              showPlayerProfiles
            />
          )}

          {scheduleQuality && scheduleQuality.maxPartnerCount > 1 && (
            <p className="text-xs text-brand-muted">
              Partner repeats: up to {scheduleQuality.maxPartnerCount}× —{' '}
              <button
                type="button"
                disabled={busy}
                onClick={() => setPreviewSeed((s) => s + 1)}
                className="font-semibold text-brand-accent"
              >
                shuffle match-ups
              </button>
            </p>
          )}

          {(seasonError || error) && (
            <p className="text-sm text-red-600">{error ?? seasonError}</p>
          )}

          <button
            type="submit"
            disabled={saveDisabled}
            className="brand-btn w-full py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Saving…' : id ? 'Save' : 'Create competition'}
          </button>
        </section>
      </div>
    </form>
  )
}
