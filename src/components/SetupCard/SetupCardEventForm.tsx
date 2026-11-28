import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useNavigate, useParams } from 'react-router-dom'
import {
  clubTimePartsFromDate,
  formatDateInput,
  formatHourLabel,
  toIsoTimestamp,
} from '../../lib/courtSchedule'
import { useAuth } from '../../hooks/useAuth'
import { useCompetitionFormDraft } from '../../hooks/useCompetitionFormDraft'
import { clearCompetitionHubCache } from '../../hooks/useCompetitionHubRows'
import {
  type CompetitionFormDraft,
  type CompetitionPlayerMode,
} from '../../lib/competitionFormDraft'
import { rosterDisplayName, type CompetitionRow } from '../../hooks/useCompetitions'
import { MemberPlayerSlots, type PadelPlayerOption } from './MemberPlayerSlots'
import {
  DuoTeamSlots,
  duoTeamsComplete,
  duoTeamsToPairSlotPayload,
  duoTeamsToRosterSlots,
  duoTeamsToScheduleInput,
  emptyDuoTeams,
  filledDuoPlayerCount,
  type DuoTeamDraft,
} from './SetupCardTeamSlots'
import { SetupCard } from './SetupCard'
import type { GameScheduleSetupValues } from './GameScheduleSetup'
import { SessionSetupControls } from './SessionSetupControls'
import { useTranslation } from '../../hooks/useTranslation'
import { measureScheduleQuality, solveBalancedSchedule } from '../../lib/balancedSchedule'
import {
  buildStoredSchedule,
  RANKED_SCHEDULE_VERSION,
  sortRosterByRank,
  targetPlayerCount,
} from '../../lib/rankedSchedule'
import { buildDuoStoredSchedule } from '../../lib/duoRoundRobinSchedule'
import {
  competitionFormatPreset,
  competitionPlayerMode,
  competitionSessionFields,
  SINGLES_COMPETITION,
  teamsFromConfig,
} from '../../lib/competitionFormatPresets'
import { buildCompetitionAutoTitle, GENDERS, SKILL_LEVELS, type Gender, type SkillLevel } from '../../lib/competitionPresets'
import { storeCompetitiveGenderFilter } from '../../lib/gamesGenderFilter'
import { hydrateDuoTeams } from '../../lib/competitionDuoTeams'
import { buildCompetitionRosterSlots } from '../../lib/competitionRosterSlots'
import {
  COURT_COUNT_OPTIONS,
  courtCountFromPlayers,
  competitionPlayStartFromAnchorIso,
  DEFAULT_SINGLES_COURT_COUNT,
  playersFromCourtCount,
  resolveCompetitionSchedule,
  teamsFromCourtCount,
  type CompetitionPlayStartMinute,
  type CourtCount,
} from '../../lib/competitionLayout'
import { totalScheduleMinutes } from '../../lib/competitionScheduleLayout'
import { supabase } from '../../lib/supabaseClient'
import type { Profile, ScoringConfig } from '../../lib/types'
import { fetchCompetitionAutoRank } from '../../lib/competitionAutoRank'

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

async function loadCompetitionRowForEdit(id: string): Promise<{ row: CompetitionRow | null; error: string | null }> {
  const { data, error: sessionErr } = await supabase
    .from('game_sessions')
    .select(
      `*,
       session_players(id, profile_id, padel_player_id, guest_name, guest_email, rank_order, profiles(id, display_name, avatar_url, avatar_mode, pixel_avatar, gender), padel_players(id, display_name, profile_id, line_picture_url, profiles(id, display_name, avatar_url, avatar_mode, pixel_avatar, gender))),
       session_pairs(id, pair_label, roster_a_id, roster_b_id)`,
    )
    .eq('id', id)
    .maybeSingle()

  if (sessionErr) return { row: null, error: sessionErr.message }
  if (!data) return { row: null, error: 'Competition not found.' }
  return { row: data as unknown as CompetitionRow, error: null }
}

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

function endIsoForWindow(day: string, startHour: number, startMinute: number, endHour: number, endMinute: number) {
  const start = new Date(toIsoTimestamp(day, startHour, startMinute))
  const end = new Date(toIsoTimestamp(day, endHour, endMinute))
  if (end <= start) end.setDate(end.getDate() + 1)
  return end.toISOString()
}

async function verifyAdminSession(
  currentSession: Session | null,
  restoreSession: () => Promise<Session | null>,
): Promise<{ session: Session | null; error: string | null }> {
  const live = currentSession?.user ? currentSession : await restoreSession()
  if (!live?.user) {
    return {
      session: null,
      error: 'Admin session expired. Reopen Sign In, then try saving again.',
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', live.user.id)
    .maybeSingle()

  if (error) return { session: live, error: error.message }
  if (!data?.is_admin) {
    return {
      session: live,
      error: 'This browser is not signed in as a database admin. Sign out and sign in with the admin LINE account.',
    }
  }

  return { session: live, error: null }
}

export function CompetitionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, restoreSession } = useAuth()
  const { t } = useTranslation()
  const [playerMode, setPlayerMode] = useState<CompetitionPlayerMode>('singles')
  const [createLeague, setCreateLeague] = useState(false)
  const [day, setDay] = useState(formatDateInput(new Date()))
  const [startHour, setStartHour] = useState(18)
  const [startMinute, setStartMinute] = useState<CompetitionPlayStartMinute>(10)
  const [endHour, setEndHour] = useState(20)
  const [endMinute, setEndMinute] = useState(0)
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('Low Inter')
  const [gender, setGender] = useState<Gender>('Mixed')
  const [title, setTitle] = useState('')
  const [titleEdited, setTitleEdited] = useState(Boolean(id))
  const [seasonId, setSeasonId] = useState('')
  const [seasonLoading, setSeasonLoading] = useState(true)
  const [seasonError, setSeasonError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const savingRef = useRef(false)
  const createRequestId = useRef<string | null>(null)
  const [autoRankBusy, setAutoRankBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playerSlots, setPlayerSlots] = useState<string[]>(() =>
    Array(playersFromCourtCount(DEFAULT_SINGLES_COURT_COUNT)).fill(''),
  )
  const [profileIds, setProfileIds] = useState<(string | null)[]>(() =>
    Array(playersFromCourtCount(DEFAULT_SINGLES_COURT_COUNT)).fill(null),
  )
  const [padelPlayerIds, setPadelPlayerIds] = useState<(string | null)[]>(() =>
    Array(playersFromCourtCount(DEFAULT_SINGLES_COURT_COUNT)).fill(null),
  )
  const [duoTeams, setDuoTeams] = useState<DuoTeamDraft[]>(() =>
    emptyDuoTeams(teamsFromCourtCount(DEFAULT_SINGLES_COURT_COUNT)),
  )
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [padelPlayers, setPadelPlayers] = useState<PadelPlayerOption[]>([])
  const [previewSeed, setPreviewSeed] = useState(0)
  const [courtCount, setCourtCount] = useState<CourtCount>(DEFAULT_SINGLES_COURT_COUNT)
  const [scheduleSetup, setScheduleSetup] = useState<GameScheduleSetupValues>(() => ({
    gameCount: SINGLES_COMPETITION.gameCount,
    gameMinutes: SINGLES_COMPETITION.gameMinutes,
    breakMinutes: SINGLES_COMPETITION.breakMinutes,
  }))
  const [slotCount, setSlotCount] = useState(playersFromCourtCount(DEFAULT_SINGLES_COURT_COUNT))
  const [competitionStarted, setCompetitionStarted] = useState(false)
  const [rosterHydrated, setRosterHydrated] = useState(!id)
  const [editLoadError, setEditLoadError] = useState<string | null>(null)
  const [duoRosterRanks, setDuoRosterRanks] = useState<Array<number | null>>([])
  const [isLeagueWeek, setIsLeagueWeek] = useState(false)
  const playerSlotsRef = useRef(playerSlots)
  const profileIdsRef = useRef(profileIds)
  const padelPlayerIdsRef = useRef(padelPlayerIds)
  const duoTeamsRef = useRef(duoTeams)
  playerSlotsRef.current = playerSlots
  profileIdsRef.current = profileIds
  padelPlayerIdsRef.current = padelPlayerIds
  duoTeamsRef.current = duoTeams

  const isDuos = playerMode === 'duos'
  const showDateFields = !createLeague || Boolean(id)
  const draftScope = id ?? 'new'

  const applyCourtCount = useCallback((courts: CourtCount) => {
    const players = playersFromCourtCount(courts)
    const teams = teamsFromCourtCount(courts)
    setCourtCount(courts)
    setSlotCount(players)
    setPlayerSlots((prev) => padArray(prev, players, ''))
    setProfileIds((prev) => padArray(prev, players, null))
    setPadelPlayerIds((prev) => padArray(prev, players, null))
    setDuoTeams((prev) =>
      emptyDuoTeams(teams).map((team, i) => {
        const saved = prev[i]
        if (!saved) return team
        return {
          ...team,
          label: saved.label,
          names: saved.names,
          profileIds: saved.profileIds,
          padelPlayerIds: saved.padelPlayerIds,
        }
      }),
    )
  }, [])

  const applyDraft = useCallback((draft: CompetitionFormDraft) => {
    setPlayerMode(draft.playerMode)
    setCreateLeague(draft.createLeague)
    setDay(draft.day)
    setStartHour(draft.startHour)
    setStartMinute(draft.startMinute)
    setEndHour(draft.endHour)
    setEndMinute(draft.endMinute)
    if (SKILL_LEVELS.includes(draft.skillLevel as SkillLevel)) {
      setSkillLevel(draft.skillLevel as SkillLevel)
    }
    if (GENDERS.includes(draft.gender as Gender)) {
      setGender(draft.gender as Gender)
    }
    setTitle(draft.title)
    setTitleEdited(draft.titleEdited)
    setPreviewSeed(draft.previewSeed)
    setScheduleSetup({
      gameCount: draft.gameCount,
      gameMinutes: draft.gameMinutes,
      breakMinutes: draft.breakMinutes,
    })
    const players = playersFromCourtCount(draft.courtCount)
    const teams = teamsFromCourtCount(draft.courtCount)
    setCourtCount(draft.courtCount)
    setSlotCount(players)
    setPlayerSlots(padArray(draft.playerSlots, players, ''))
    setDuoTeams(
      emptyDuoTeams(teams).map((team, index) => {
        const saved = draft.duoTeams[index]
        if (!saved) return team
        return {
          ...team,
          label: saved.label,
          names: saved.names,
        }
      }),
    )
  }, [])

  const draftValues = useMemo(
    (): Omit<CompetitionFormDraft, 'v' | 'savedAt'> => ({
      playerMode,
      courtCount,
      gameCount: scheduleSetup.gameCount,
      gameMinutes: scheduleSetup.gameMinutes,
      breakMinutes: scheduleSetup.breakMinutes,
      createLeague,
      day,
      startHour,
      startMinute,
      endHour,
      endMinute,
      skillLevel,
      gender,
      title,
      titleEdited,
      playerSlots,
      duoTeams: duoTeams.map((team) => ({ label: team.label, names: team.names })),
      previewSeed,
    }),
    [
      playerMode,
      courtCount,
      scheduleSetup,
      createLeague,
      day,
      startHour,
      startMinute,
      endHour,
      endMinute,
      skillLevel,
      gender,
      title,
      titleEdited,
      playerSlots,
      duoTeams,
      previewSeed,
    ],
  )

  const { clearDraft } = useCompetitionFormDraft({
    scope: draftScope,
    restore: !id,
    persist: !id,
    values: draftValues,
    onRestore: applyDraft,
  })

  const startsAtIso = useMemo(
    () => toIsoTimestamp(day, startHour, startMinute),
    [day, startHour, startMinute],
  )
  const endsAtIso = useMemo(
    () => endIsoForWindow(day, startHour, startMinute, endHour, endMinute),
    [day, startHour, startMinute, endHour, endMinute],
  )
  const windowMinutes = useMemo(
    () => windowMinutesBetween(startHour, startMinute, endHour, endMinute),
    [startHour, startMinute, endHour, endMinute],
  )
  const competitionSchedule = useMemo(
    () => ({
      games: scheduleSetup.gameCount,
      gameMinutes: scheduleSetup.gameMinutes,
      breakMinutes: scheduleSetup.breakMinutes,
    }),
    [scheduleSetup],
  )
  const autoTitle = useMemo(
    () =>
      buildCompetitionAutoTitle(
        skillLevel,
        gender,
        competitionPlayStartFromAnchorIso(startsAtIso),
      ),
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
  const filledDuoCount = useMemo(() => filledDuoPlayerCount(duoTeams), [duoTeams])
  const canBuildDuoSchedule = duoTeamsComplete(duoTeams)
  useEffect(() => {
    void Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').order('display_name'),
      supabase
        .from('padel_players')
        .select('id, display_name, profile_id, line_picture_url')
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
    setError(null)
  }

  useEffect(() => {
    setSeasonLoading(true)
    setSeasonError(null)
    void (async () => {
      const { data, error: seasonQueryError } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      const activeSeasonId = seasonQueryError ? null : data?.[0]?.id
      if (activeSeasonId) {
        setSeasonId(activeSeasonId)
        setSeasonLoading(false)
        return
      }

      const { data: fallbackRows, error: fallbackErr } = await supabase
        .from('game_sessions')
        .select('season_id')
        .eq('game_kind', 'competition')
        .not('season_id', 'is', null)
        .order('starts_at', { ascending: false })
        .limit(1)

      const fallbackSeasonId = fallbackRows?.[0]?.season_id
      if (fallbackErr) setSeasonError(fallbackErr.message)
      else if (fallbackSeasonId) setSeasonId(fallbackSeasonId)
      else if (seasonQueryError) setSeasonError(seasonQueryError.message)
      setSeasonLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!id) return
    setRosterHydrated(false)
    setEditLoadError(null)
    let active = true
    void (async () => {
      const { row: session, error: sessionErr } = await loadCompetitionRowForEdit(id)

      if (!active) return
      if (sessionErr || !session) {
        setRosterHydrated(true)
        setEditLoadError(sessionErr ?? 'Competition not found.')
        return
      }

      const mode = competitionPlayerMode(session.scoring_config as ScoringConfig)
      setPlayerMode(mode)
      setIsLeagueWeek(Boolean(session.game_group_id))
      const target =
        session.target_players ?? session.max_players ?? competitionFormatPreset(mode).targetPlayers
      setSlotCount(target)
      setCourtCount(courtCountFromPlayers(target))
      setCompetitionStarted(Boolean(session.competition_started_at))
      if (session.season_id) {
        setSeasonId(session.season_id)
        setSeasonError(null)
      }
      if (session.skill_level && SKILL_LEVELS.includes(session.skill_level as SkillLevel)) {
        setSkillLevel(session.skill_level as SkillLevel)
      }
      if (session.gender && GENDERS.includes(session.gender as Gender)) {
        setGender(session.gender as Gender)
      }
      setTitle(session.title)
      setTitleEdited(true)
      const config = session.scoring_config as ScoringConfig | null
      if (typeof config?.schedule_seed === 'number') {
        setPreviewSeed(config.schedule_seed)
      }
      const schedule = resolveCompetitionSchedule(session)
      setScheduleSetup({
        gameCount: schedule.totalGames,
        gameMinutes: schedule.gameMinutes,
        breakMinutes: schedule.breakMinutes,
      })
      if (session.starts_at) {
        setDay(bangkokDateFromIso(session.starts_at))
        const parts = clubTimePartsFromDate(new Date(session.starts_at))
        setStartHour(parts.hour)
        setStartMinute(parts.minute)
        const endAt = session.ends_at ?? schedule.eventEndsAt?.toISOString()
        if (endAt) {
          const endParts = clubTimePartsFromDate(new Date(endAt))
          setEndHour(endParts.hour)
          setEndMinute(endParts.minute)
        }
      } else if (session.starts_on) {
        setDay(session.starts_on)
      }

      const nextNames = Array(target).fill('')
      const nextIds = Array<string | null>(target).fill(null)
      const nextPadelIds = Array<string | null>(target).fill(null)
      const padelIdsOnRoster = new Set<string>()
      const rosterRows = sortRosterByRank(session.session_players ?? [])

      for (const r of rosterRows) {
        const idx = r.rank_order ?? 0
        if (idx >= 0 && idx < nextNames.length) {
          nextNames[idx] = rosterDisplayName(r)
          nextIds[idx] = r.profile_id
          nextPadelIds[idx] = r.padel_player_id
          if (r.padel_player_id) padelIdsOnRoster.add(r.padel_player_id)
        }
      }

      if (mode === 'duos') {
        const pairs = session.session_pairs?.length
          ? session.session_pairs
          : teamsFromConfig(config).map((team) => ({
            pair_label: team.label,
            roster_a_id: team.roster_ids[0],
            roster_b_id: team.roster_ids[1],
          }))
        const fixedRoster = hydrateDuoTeams(
          rosterRows.map((row) => ({
            id: row.id,
            rank: row.rank_order ?? -1,
            name: rosterDisplayName(row),
            profileId: row.profile_id,
            padelPlayerId: row.padel_player_id,
          })),
          pairs,
          teamsFromCourtCount(courtCountFromPlayers(target)),
        )
        if (!fixedRoster) {
          setDuoTeams(emptyDuoTeams(teamsFromCourtCount(courtCountFromPlayers(target))))
          setDuoRosterRanks([])
          setEditLoadError('Fixed-pair roster incomplete. Correct the saved teams before editing.')
        } else {
          setDuoTeams(fixedRoster.teams)
          setDuoRosterRanks(fixedRoster.ranks)
        }
      } else {
        setPlayerSlots(nextNames)
        setProfileIds(nextIds)
        setPadelPlayerIds(nextPadelIds)
      }

      if (padelIdsOnRoster.size > 0) {
        const { data: rosterPadel } = await supabase
          .from('padel_players')
          .select('id, display_name, profile_id, line_picture_url')
          .in('id', [...padelIdsOnRoster])
        if (!active) return
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
    return () => { active = false }
  }, [id])

  const saveCompetition = async () => {
    await flushPendingInputs()

    if (!seasonId) {
      setError('No active season.')
      return
    }
    const scheduledMinutes = totalScheduleMinutes(
      scheduleSetup.gameCount,
      scheduleSetup.gameMinutes,
      scheduleSetup.breakMinutes,
    )
    if (showDateFields && scheduledMinutes > windowMinutes) {
      setError(
        `Schedule needs ${scheduledMinutes} minutes but the selected window has ${windowMinutes}.`,
      )
      return
    }

    const admin = await verifyAdminSession(session, restoreSession)
    if (admin.error || !admin.session?.user) {
      setError(admin.error ?? 'Admin session expired. Reopen Sign In, then try saving again.')
      return
    }

    const finalTitle = title.trim() || autoTitle
    const targetPlayers = playersFromCourtCount(courtCount)
    const lockedFields = competitionSessionFields(playerMode, {
      skillLevel,
      gender,
      targetPlayers,
      schedule: competitionSchedule,
    })

    const savedTeamDraft = duoTeamsRef.current
    const rosterPayload = isDuos
      ? duoTeamsToRosterSlots(savedTeamDraft)
      : buildCompetitionRosterSlots(
        padArray(playerSlotsRef.current, slotCount, ''),
        profileIdsRef.current,
        padelPlayerIdsRef.current,
      )

    // Existing rounds are the draw authority. Never sync/delete the roster or
    // invoke the schedule generator when deliberately editing a running event.
    if (id && competitionStarted) {
      let startedRoster = rosterPayload
      if (isDuos) {
        const byRank = rosterPayload
          .flatMap((slot, index) => {
            const rank = duoRosterRanks[index]
            return rank == null ? [] : [{ slot, rank }]
          })
          .sort((a, b) => a.rank - b.rank)
        if (byRank.some(({ rank }, index) => rank !== index)) {
          setError('The existing roster ranks could not be restored. Reload before editing.')
          return
        }
        startedRoster = byRank.map(({ slot }) => slot)
      }
      const { error: editError } = await supabase.rpc('edit_competition_preserving_draw', {
        p_session_id: id,
        p_slots: startedRoster,
        p_starts_at: startsAtIso,
        p_ends_at: endsAtIso,
        p_games: competitionSchedule.games,
        p_game_minutes: competitionSchedule.gameMinutes,
        p_break_minutes: competitionSchedule.breakMinutes,
        p_title: finalTitle,
      })
      if (editError) {
        setError(editError.code === 'PGRST202'
          ? 'Safe editing is not installed in the database yet. Nothing was changed.'
          : editError.message)
        return
      }
      clearDraft()
      clearCompetitionHubCache()
      window.location.assign(`/competitions/${id}`)
      return
    }

    const isLeague = isDuos && createLeague && !id
    const sessionFields = {
      season_id: seasonId,
      title: finalTitle,
      ...(!isLeague ? {
        starts_at: startsAtIso,
        ends_at: endsAtIso,
      } : {}),
      ...lockedFields,
    }

    const rosterSize = rosterPayload.filter((slot) => slot.name.trim()).length
    const effectiveSlotCount = targetPlayerCount(
      { target_players: slotCount, max_players: slotCount },
      rosterSize,
      isDuos,
    )
    const slotIds = Array.from({ length: effectiveSlotCount }, (_, rank) => String(rank))
    const canSaveSchedule = isDuos
      ? duoTeamsComplete(savedTeamDraft)
      : rosterSize >= 4 && effectiveSlotCount >= 4 && effectiveSlotCount % 4 === 0
    const schedule = !canSaveSchedule ? null : isDuos
      ? buildDuoStoredSchedule(
        duoTeamsToScheduleInput(savedTeamDraft, slotIds),
        scheduleSetup.gameCount,
        previewSeed,
      )
      : buildStoredSchedule(
        slotIds.map((slotId) => ({ id: slotId })),
        solveBalancedSchedule(effectiveSlotCount, scheduleSetup.gameCount, previewSeed),
      )

    const requestId = id ?? (createRequestId.current ??= crypto.randomUUID())
    const { data: sessionId, error: saveError } = await supabase.rpc('save_competition_setup', {
      p_request_id: requestId,
      p_create: !id,
      p_league: isLeague,
      p_fields: sessionFields,
      p_slots: rosterPayload,
      p_pairs: isDuos ? duoTeamsToPairSlotPayload(savedTeamDraft) : null,
      p_slot_schedule: schedule,
      p_schedule_seed: previewSeed,
      p_schedule_version: RANKED_SCHEDULE_VERSION,
    })
    if (saveError || !sessionId) {
      setError(saveError?.code === 'PGRST202'
        ? 'Competition setup is unavailable. Try again after the update.'
        : saveError?.message ?? 'Could not save the competition.')
      return
    }

    clearDraft()
    clearCompetitionHubCache()
    storeCompetitiveGenderFilter(gender)
    if (isLeague) {
      navigate('/competitive')
    } else if (id) {
      window.location.assign(`/competitions/${sessionId}`)
    } else {
      void supabase.rpc('start_competition', { p_session_id: sessionId })
      navigate(`/competitions/${sessionId}`)
    }
  }

  const save = async () => {
    if (savingRef.current || (id && (!rosterHydrated || editLoadError))) return
    savingRef.current = true
    setBusy(true)
    setError(null)
    try {
      await saveCompetition()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the competition.')
    } finally {
      savingRef.current = false
      setBusy(false)
    }
  }

  const autoRankRoster = async () => {
    await flushPendingInputs()
    setAutoRankBusy(true)
    setError(null)

    const admin = await verifyAdminSession(session, restoreSession)
    if (admin.error || !admin.session?.user) {
      setAutoRankBusy(false)
      setError(admin.error ?? 'Admin session expired. Reopen Sign In, then try ranking again.')
      return
    }

    const currentTeams = duoTeamsRef.current
    const currentNames = isDuos
      ? currentTeams.flatMap((team) => team.names)
      : playerSlotsRef.current.slice(0, slotCount)
    const currentProfileIds = isDuos
      ? currentTeams.flatMap((team) => team.profileIds)
      : profileIdsRef.current.slice(0, slotCount)
    const currentPadelIds = isDuos
      ? currentTeams.flatMap((team) => team.padelPlayerIds)
      : padelPlayerIdsRef.current.slice(0, slotCount)

    if (
      currentNames.length !== slotCount ||
      currentNames.some((name) => !name.trim())
    ) {
      setAutoRankBusy(false)
      setError('Enter every player before auto-ranking.')
      return
    }

    const result = await fetchCompetitionAutoRank(
      currentNames.map((_, slotIndex) => ({
        slotIndex,
        profileId: currentProfileIds[slotIndex] ?? null,
        padelPlayerId: currentPadelIds[slotIndex] ?? null,
      })),
      gender,
    )
    if (result.error || result.rows.length !== slotCount) {
      setAutoRankBusy(false)
      setError(result.error ?? 'Could not rank the complete roster.')
      return
    }

    if (isDuos) {
      const rankBySlot = new Map(result.rows.map((row, index) => [row.slot_index, { ...row, randomOrder: index }]))
      const rankedTeams = currentTeams
        .map((team, teamIndex) => {
          const a = rankBySlot.get(teamIndex * 2)
          const b = rankBySlot.get(teamIndex * 2 + 1)
          return {
            team,
            history: (a?.competitions ?? 0) + (b?.competitions ?? 0),
            points: (a?.ranking_points ?? 0) + (b?.ranking_points ?? 0),
            randomOrder: Math.min(a?.randomOrder ?? 0, b?.randomOrder ?? 0),
          }
        })
        .sort(
          (a, b) =>
            Number(b.history > 0) - Number(a.history > 0) ||
            b.points - a.points ||
            a.randomOrder - b.randomOrder,
        )
        .map((entry) => entry.team)
      setDuoTeams(rankedTeams)
    } else {
      const order = result.rows.map((row) => row.slot_index)
      setPlayerSlots(order.map((index) => currentNames[index] ?? ''))
      setProfileIds(order.map((index) => currentProfileIds[index] ?? null))
      setPadelPlayerIds(order.map((index) => currentPadelIds[index] ?? null))
    }

    setPreviewSeed((seed) => seed + 1)
    setAutoRankBusy(false)
  }

  const saveDisabled =
    busy || (Boolean(id) && (!rosterHydrated || Boolean(editLoadError))) || (!id && seasonLoading)
  const scheduleQuality = useMemo(() => {
    if (filledNameCount < 4 || isDuos) return null
    const previewSlotCount = targetPlayerCount(
      { target_players: slotCount, max_players: slotCount },
      filledNameCount,
      false,
    )
    const rounds = solveBalancedSchedule(
      previewSlotCount,
      scheduleSetup.gameCount,
      previewSeed,
    )
    return measureScheduleQuality(rounds, previewSlotCount)
  }, [previewSeed, filledNameCount, slotCount, isDuos, scheduleSetup.gameCount])

  return (
    <form
      className="competition-setup-form w-full space-y-3 pb-[calc(var(--app-shell-dock-height)+2rem)]"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <SetupCard>
        <SessionSetupControls
          formatLabel={t('competition.formatLabel')}
          playerMode={playerMode}
          playerModeOptions={[
            { value: 'singles', label: t('competition.formatSingles'), disabled: competitionStarted },
            { value: 'duos', label: t('competition.formatDuos'), disabled: competitionStarted },
          ]}
          onPlayerModeChange={(mode) => {
            setPlayerMode(mode)
            applyCourtCount(courtCount)
          }}
          courtsLabel={t('competition.courts')}
          courtCount={courtCount}
          courtOptions={COURT_COUNT_OPTIONS}
          courtControlsDisabled={competitionStarted}
          onCourtCountChange={(count) => {
            if (!competitionStarted) applyCourtCount(count)
          }}
          schedule={{
            value: {
              gameCount: scheduleSetup.gameCount,
              gameMinutes: scheduleSetup.gameMinutes,
              breakMinutes: scheduleSetup.breakMinutes,
            },
            dateValue: showDateFields ? day : undefined,
            onDateChange: showDateFields ? setDay : undefined,
            startValue: formatHourLabel(startHour, startMinute),
            endValue: formatHourLabel(endHour, endMinute),
            windowMinutes: showDateFields ? windowMinutes : null,
            onStartChange: (value) => {
              const { hour, minute } = parseTimeInput(value, startHour, startMinute)
              setStartHour(hour)
              setStartMinute(minute)
            },
            onEndChange: (value) => {
              const { hour, minute } = parseTimeInput(value, endHour, endMinute)
              setEndHour(hour)
              setEndMinute(minute)
            },
            onChange: (patch) => {
              setScheduleSetup((prev) => ({
                ...prev,
                ...patch,
                breakMinutes: patch.breakMinutes ?? prev.breakMinutes,
              }))
            },
          }}
          scheduleNotice={
            <>
              {isLeagueWeek ? (
                <p className="text-xs text-brand-muted">{t('competition.leagueDatesLater')}</p>
              ) : null}
              {isDuos && !id ? (
                <label className="flex items-center gap-2 text-sm text-brand-text">
                  <input
                    type="checkbox"
                    checked={createLeague}
                    onChange={(e) => setCreateLeague(e.target.checked)}
                    className="rounded border-brand-border"
                  />
                  {t('competition.createLeague')}
                </label>
              ) : null}
              {!showDateFields ? (
                <p className="text-xs text-brand-muted">{t('competition.leagueDatesLater')}</p>
              ) : null}
            </>
          }
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
        />

        {!rosterHydrated && id ? (
          <p className="text-sm text-brand-muted">{t('common.loading')}</p>
        ) : editLoadError ? null : isDuos ? (
          <DuoTeamSlots
            teams={duoTeams}
            profiles={profiles}
            padelPlayers={padelPlayers}
            onChange={setDuoTeams}
            disabled={busy}
            layout="grid"
            setupRosterLayout
          />
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
            showSlotNumbers={false}
            setupRosterLayout
          />
        )}

        <div className="setup-auto-rank">
          <button
            type="button"
            className="setup-auto-rank__button"
            disabled={busy || autoRankBusy || competitionStarted || Boolean(editLoadError)}
            onClick={() => void autoRankRoster()}
          >
            {autoRankBusy ? 'Ranking…' : 'Auto-rank roster'}
          </button>
        </div>

        {isDuos && filledDuoCount > 0 && !canBuildDuoSchedule ? (
          <p className="text-xs text-brand-muted">{t('competition.duoTeamsIncomplete')}</p>
        ) : null}

        {scheduleQuality && scheduleQuality.maxPartnerCount > 1 ? (
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
        ) : null}

        {isDuos && canBuildDuoSchedule ? (
          <p className="text-xs text-brand-muted">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPreviewSeed((s) => s + 1)}
              className="font-semibold text-brand-accent"
            >
              {t('competition.shuffleDuoRound')}
            </button>
          </p>
        ) : null}

        {(editLoadError || seasonError || error) && (
          <p className="text-sm text-red-600">{editLoadError ?? error ?? seasonError}</p>
        )}
        <button
          type="submit"
          disabled={saveDisabled}
          className="competition-setup-submit brand-btn w-full py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy
            ? 'Saving…'
            : id
              ? 'Save'
              : createLeague && isDuos
                ? t('competition.createLeagueBtn')
                : 'Create competition'}
        </button>
      </SetupCard>
    </form>
  )
}
