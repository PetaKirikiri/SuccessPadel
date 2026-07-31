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
import { rosterDisplayName, type CompetitionPlayer, type CompetitionRow } from '../../hooks/useCompetitions'
import { MemberPlayerSlots, type PadelPlayerOption } from './MemberPlayerSlots'
import {
  DuoTeamSlots,
  duoTeamsComplete,
  duoTeamsToPairPayload,
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
  padRosterToTarget,
  sortRosterByRank,
  targetPlayerCount,
} from '../../lib/rankedSchedule'
import { buildDuoStoredSchedule } from '../../lib/duoRoundRobinSchedule'
import {
  competitionFormatPreset,
  competitionPlayerMode,
  competitionScoringConfig,
  competitionSessionFields,
  SINGLES_COMPETITION,
  type CompetitionTeamConfig,
} from '../../lib/competitionFormatPresets'
import { buildCompetitionAutoTitle, GENDERS, SKILL_LEVELS, type Gender, type SkillLevel } from '../../lib/competitionPresets'
import { storeCompetitiveGenderFilter } from '../../lib/gamesGenderFilter'
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
import {
  saveScheduleForSession,
} from '../../lib/persistCompetitionSchedule'
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

function rosterIdsInOrder(rows: CompetitionPlayer[]): string[] {
  return sortRosterByRank(rows).map((row) => row.id)
}

async function loadCompetitionRowForEdit(id: string): Promise<{ row: CompetitionRow | null; error: string | null }> {
  const { data: listed, error: listErr } = await supabase.rpc('list_competitions_for_setup')
  if (!listErr) {
    const row = ((listed as CompetitionRow[] | null) ?? []).find((candidate) => candidate.id === id)
    if (row) return { row, error: null }
  }

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
  if (!data) return { row: null, error: listErr?.message ?? 'Competition not found.' }
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
    void (async () => {
      const { row: session, error: sessionErr } = await loadCompetitionRowForEdit(id)

      if (sessionErr || !session) {
        setRosterHydrated(true)
        if (sessionErr) setError(sessionErr)
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
        const teams = emptyDuoTeams(teamsFromCourtCount(courtCountFromPlayers(target))).map(
          (team, teamIndex) => {
            const base = teamIndex * 2
            return {
              ...team,
              names: [nextNames[base] ?? '', nextNames[base + 1] ?? ''] as [string, string],
              profileIds: [nextIds[base] ?? null, nextIds[base + 1] ?? null] as [
                string | null,
                string | null,
              ],
              padelPlayerIds: [nextPadelIds[base] ?? null, nextPadelIds[base + 1] ?? null] as [
                string | null,
                string | null,
              ],
            }
          },
        )
        const rankByRosterId = new Map(
          rosterRows.map((row) => [row.id, row.rank_order ?? 0]),
        )
        for (const pair of session.session_pairs ?? []) {
          const rankA = rankByRosterId.get(pair.roster_a_id ?? '')
          if (rankA == null) continue
          const teamIndex = Math.floor(rankA / 2)
          if (teamIndex >= 0 && teamIndex < teams.length && pair.pair_label) {
            teams[teamIndex] = { ...teams[teamIndex], label: pair.pair_label }
          }
        }
        setDuoTeams(teams)
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

    setBusy(true)
    setError(null)

    const admin = await verifyAdminSession(session, restoreSession)
    if (admin.error || !admin.session?.user) {
      setBusy(false)
      setError(admin.error ?? 'Admin session expired. Reopen Sign In, then try saving again.')
      return
    }

    const finalTitle = title.trim() || autoTitle
    const targetPlayers = playersFromCourtCount(courtCount)
    const baseConfig = competitionScoringConfig(playerMode)
    const lockedFields = competitionSessionFields(playerMode, {
      skillLevel,
      gender,
      targetPlayers,
      schedule: competitionSchedule,
    })

    const rosterPayload = isDuos
      ? duoTeamsToRosterSlots(duoTeams)
      : buildCompetitionRosterSlots(trimmedSlots, profileIds, padelPlayerIds)

    if (isDuos && createLeague && !id) {
      const { data: leagueResult, error: leagueErr } = await supabase.rpc('create_duo_league', {
        p_season_id: seasonId,
        p_title: finalTitle,
        p_skill_level: skillLevel,
        p_gender: gender,
        p_slots: rosterPayload,
        p_pairs: [],
        p_scoring_config: baseConfig,
        p_created_by: admin.session.user.id,
        p_target_players: targetPlayers,
        p_schedule_game_count: competitionSchedule.games,
        p_schedule_game_minutes: competitionSchedule.gameMinutes,
        p_schedule_break_minutes: competitionSchedule.breakMinutes,
      })
      if (leagueErr || !leagueResult) {
        setBusy(false)
        setError(leagueErr?.message ?? 'Could not create league')
        return
      }

      const sessionIds = (leagueResult.session_ids as string[] | undefined) ?? []
      for (const sessionId of sessionIds) {
        const { data: rosterRows, error: rosterLoadErr } = await supabase
          .from('session_players')
          .select('id, guest_name, rank_order, profile_id, profiles(display_name)')
          .eq('session_id', sessionId)
          .order('rank_order')
        if (rosterLoadErr || !rosterRows) {
          setBusy(false)
          setError(rosterLoadErr?.message ?? 'Could not load league roster')
          return
        }
        const ranked = sortRosterByRank(rosterRows as unknown as CompetitionPlayer[])
        const rosterIds = rosterIdsInOrder(ranked)
        const pairs = duoTeamsToPairPayload(duoTeams, rosterIds)
        const { error: pairErr } = await supabase.rpc('sync_competition_pairs', {
          p_session_id: sessionId,
          p_pairs: pairs,
        })
        if (pairErr) {
          setBusy(false)
          setError(pairErr.message)
          return
        }
        if (canBuildDuoSchedule) {
          const schedule = buildDuoStoredSchedule(
            duoTeamsToScheduleInput(duoTeams, rosterIds),
            scheduleSetup.gameCount,
            previewSeed,
          )
          const teamsConfig: CompetitionTeamConfig[] = pairs.map((pair) => ({
            label: pair.label,
            roster_ids: [pair.roster_a_id, pair.roster_b_id],
          }))
          const cfgErr = await saveScheduleForSession(
            sessionId,
            { ...baseConfig, teams: teamsConfig },
            schedule,
            previewSeed,
          )
          if (cfgErr) {
            setBusy(false)
            setError(cfgErr)
            return
          }
        }
      }

      clearDraft()
      clearCompetitionHubCache()
      setBusy(false)
      storeCompetitiveGenderFilter(gender)
      navigate('/competitive')
      return
    }

    const startsAt = showDateFields ? new Date(startsAtIso) : null
    const endsAt = showDateFields ? new Date(endsAtIso) : null

    const sessionFields = {
      season_id: seasonId,
      title: finalTitle,
      ...(startsAt
        ? {
            starts_on: day,
            ends_on: bangkokDateFromIso(endsAt!.toISOString()),
            starts_at: startsAt.toISOString(),
            ends_at: endsAt!.toISOString(),
          }
        : {}),
      game_kind: 'competition' as const,
      visibility: 'open' as const,
      created_by: admin.session.user.id,
      ...lockedFields,
    }
    const payload = id ? sessionFields : { ...sessionFields, status: 'open' as const }

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
        .limit(1)
      const createdId = data?.[0]?.id
      if (err || !createdId) {
        setBusy(false)
        setError(err?.message ?? 'Could not create competition')
        return
      }
      sessionId = createdId
    }

    const pairSlotPayload = isDuos ? duoTeamsToPairSlotPayload(duoTeams) : null

    const { error: rosterErr } = await supabase.rpc('sync_competition_roster_slots', {
      p_session_id: sessionId,
      p_slots: rosterPayload,
      ...(pairSlotPayload?.length ? { p_pairs: pairSlotPayload } : {}),
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
    if (rosterLoadErr) {
      setBusy(false)
      setError(rosterLoadErr.message)
      return
    }

    const ranked = sortRosterByRank((rosterRows ?? []) as unknown as CompetitionPlayer[])
    const rosterIds = rosterIdsInOrder(ranked)
    const effectiveSlotCount = targetPlayerCount(
      { target_players: slotCount, max_players: slotCount },
      ranked.length,
      isDuos,
    )

    const canSaveSchedule = isDuos
      ? canBuildDuoSchedule
      : ranked.length >= 4 && effectiveSlotCount >= 4 && effectiveSlotCount % 4 === 0

    if (canSaveSchedule) {
      let schedule: ReturnType<typeof buildStoredSchedule> = []
      let teamsConfig: CompetitionTeamConfig[] | undefined

      if (isDuos) {
        schedule = buildDuoStoredSchedule(
          duoTeamsToScheduleInput(duoTeams, rosterIds),
          scheduleSetup.gameCount,
          previewSeed,
        )
        teamsConfig = duoTeamsToPairPayload(duoTeams, rosterIds).map((pair) => ({
          label: pair.label,
          roster_ids: [pair.roster_a_id, pair.roster_b_id],
        }))
      } else {
        const padded = padRosterToTarget(ranked, effectiveSlotCount)
        schedule = buildStoredSchedule(
          padded,
          solveBalancedSchedule(effectiveSlotCount, scheduleSetup.gameCount, previewSeed),
        )
      }

      const cfgErr = await saveScheduleForSession(
        sessionId!,
        { ...baseConfig, ...(teamsConfig ? { teams: teamsConfig } : {}) },
        schedule,
        previewSeed,
      )
      if (cfgErr) {
        setBusy(false)
        setError(cfgErr)
        return
      }
    }

    if (competitionStarted && canSaveSchedule) {
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
    clearCompetitionHubCache()

    if (id) {
      setBusy(false)
      storeCompetitiveGenderFilter(gender)
      window.location.assign(`/competitions/${sessionId}`)
      return
    }

    if (!competitionStarted && sessionId) {
      void supabase.rpc('start_competition', { p_session_id: sessionId })
    }

    setBusy(false)
    storeCompetitiveGenderFilter(gender)
    navigate(`/competitions/${sessionId}`)
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
    busy || (Boolean(id) && !rosterHydrated) || (!id && seasonLoading)
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
            { value: 'singles', label: t('competition.formatSingles') },
            { value: 'duos', label: t('competition.formatDuos') },
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
        ) : isDuos ? (
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
            disabled={busy || autoRankBusy}
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

        {(seasonError || error) && (
          <p className="text-sm text-red-600">{error ?? seasonError}</p>
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
