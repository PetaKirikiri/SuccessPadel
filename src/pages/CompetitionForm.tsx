import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  clubTimePartsFromDate,
  formatDateInput,
  formatHourLabel,
} from '../lib/courtSchedule'
import { useAuth } from '../hooks/useAuth'
import { useCompetitionFormDraft } from '../hooks/useCompetitionFormDraft'
import {
  type CompetitionFormDraft,
  type CompetitionPlayerMode,
} from '../lib/competitionFormDraft'
import type { CompetitionPlayer } from '../hooks/useCompetitions'
import { MemberPlayerSlots, type PadelPlayerOption } from '../components/MemberPlayerSlots'
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
} from '../components/DuoTeamSlots'
import { SetupCard } from '../components/cards/SetupCard'
import { useTranslation } from '../hooks/useTranslation'
import { measureScheduleQuality, solveBalancedSchedule } from '../lib/balancedSchedule'
import {
  buildStoredSchedule,
  padRosterToTarget,
  sortRosterByRank,
  targetPlayerCount,
} from '../lib/rankedSchedule'
import { buildDuoStoredSchedule } from '../lib/duoRoundRobinSchedule'
import {
  competitionEventMinutes,
  competitionFormatPreset,
  competitionPlayerMode,
  competitionScoringConfig,
  competitionSessionFields,
  SINGLES_COMPETITION,
  type CompetitionTeamConfig,
} from '../lib/competitionFormatPresets'
import { buildCompetitionAutoTitle, GENDERS, SKILL_LEVELS, type Gender, type SkillLevel } from '../lib/competitionPresets'
import { buildCompetitionRosterSlots } from '../lib/competitionRosterSlots'
import {
  COURT_COUNT_OPTIONS,
  courtCountFromPlayers,
  competitionPlayStartFromAnchorIso,
  competitionStartsAtAnchorIso,
  DEFAULT_SINGLES_COURT_COUNT,
  duoGameCountFromCourtCount,
  parseCompetitionStartSlotValue,
  playersFromCourtCount,
  scheduleCompetitionStartSlots,
  snapToCompetitionPlayStart,
  teamsFromCourtCount,
  type CompetitionPlayStartMinute,
  type CourtCount,
} from '../lib/competitionLayout'
import { ruleChips as sessionRuleChips } from '../lib/sessionDisplay'
import { supabase } from '../lib/supabaseClient'
import {
  saveScheduleForSession,
} from '../lib/persistCompetitionSchedule'
import type { Profile, ScoringConfig } from '../lib/types'

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

function rosterIdsInOrder(rows: CompetitionPlayer[]): string[] {
  return sortRosterByRank(rows).map((row) => row.id)
}

export function CompetitionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [playerMode, setPlayerMode] = useState<CompetitionPlayerMode>('singles')
  const [createLeague, setCreateLeague] = useState(false)
  const [day, setDay] = useState(formatDateInput(new Date()))
  const [startHour, setStartHour] = useState(18)
  const [startMinute, setStartMinute] = useState<CompetitionPlayStartMinute>(4)
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
  const [slotCount, setSlotCount] = useState(playersFromCourtCount(DEFAULT_SINGLES_COURT_COUNT))
  const [competitionStarted, setCompetitionStarted] = useState(false)
  const [rosterHydrated, setRosterHydrated] = useState(!id)
  const [isLeagueWeek, setIsLeagueWeek] = useState(false)

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
    setStartMinute(draft.startMinute === 34 ? 34 : 4)
    if (SKILL_LEVELS.includes(draft.skillLevel as SkillLevel)) {
      setSkillLevel(draft.skillLevel as SkillLevel)
    }
    if (GENDERS.includes(draft.gender as Gender)) {
      setGender(draft.gender as Gender)
    }
    setTitle(draft.title)
    setTitleEdited(draft.titleEdited)
    setPreviewSeed(draft.previewSeed)
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
      createLeague,
      day,
      startHour,
      startMinute,
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
      createLeague,
      day,
      startHour,
      startMinute,
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

  const competitionStartSlots = useMemo(() => scheduleCompetitionStartSlots(), [])
  const startsAtIso = useMemo(
    () => competitionStartsAtAnchorIso(day, startHour, startMinute),
    [day, startHour, startMinute],
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
    setError(null)
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

      const mode = competitionPlayerMode(data.scoring_config as ScoringConfig)
      setPlayerMode(mode)
      setIsLeagueWeek(Boolean(data.game_group_id))
      const target =
        data.target_players ?? data.max_players ?? competitionFormatPreset(mode).targetPlayers
      setSlotCount(target)
      setCourtCount(courtCountFromPlayers(target))
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
        const snapped = snapToCompetitionPlayStart(parts.hour, parts.minute)
        const match =
          competitionStartSlots.find(
            (s) => s.hour === snapped.hour && s.minute === snapped.minute,
          ) ??
          competitionStartSlots.find((s) => s.hour === snapped.hour) ??
          competitionStartSlots[0]
        if (match) {
          setStartHour(match.hour)
          setStartMinute(match.minute)
        }
      } else if (data.starts_on) {
        setDay(data.starts_on)
      }

      const { data: rosterRows, error: rosterErr } = await supabase
        .from('session_players')
        .select('id, guest_name, rank_order, profile_id, padel_player_id, profiles(display_name)')
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
          id: string
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
        const { data: pairRows } = await supabase
          .from('session_pairs')
          .select('pair_label, roster_a_id, roster_b_id')
          .eq('session_id', id)
        const rankByRosterId = new Map(
          (rosterRows ?? []).map((row) => [
            (row as { id: string }).id,
            (row as { rank_order: number | null }).rank_order ?? 0,
          ]),
        )
        for (const pair of pairRows ?? []) {
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

    setBusy(true)
    setError(null)

    const finalTitle = title.trim() || autoTitle
    const targetPlayers = playersFromCourtCount(courtCount)
    const duoGameCount = isDuos ? duoGameCountFromCourtCount(courtCount) : undefined
    const baseConfig = competitionScoringConfig(playerMode, { gameCount: duoGameCount })
    const lockedFields = competitionSessionFields(playerMode, {
      skillLevel,
      gender,
      targetPlayers,
      gameCount: duoGameCount,
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
        p_created_by: user?.id ?? null,
        p_target_players: targetPlayers,
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
            duoGameCount!,
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
      setBusy(false)
      navigate('/competitive')
      return
    }

    const eventMinutes = competitionEventMinutes(playerMode, duoGameCount)
    const startsAt = showDateFields ? new Date(startsAtIso) : null
    const endsAt =
      startsAt != null ? new Date(startsAt.getTime() + eventMinutes * 60 * 1000) : null

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
      created_by: user?.id ?? null,
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
        .single()
      if (err || !data) {
        setBusy(false)
        setError(err?.message ?? 'Could not create competition')
        return
      }
      sessionId = data.id
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
          duoGameCount!,
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
          solveBalancedSchedule(effectiveSlotCount, SINGLES_COMPETITION.gameCount, previewSeed),
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

    if (!competitionStarted && sessionId) {
      void supabase.rpc('start_competition', { p_session_id: sessionId })
    }

    setBusy(false)
    navigate(`/competitions/${sessionId}`)
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
      SINGLES_COMPETITION.gameCount,
      previewSeed,
    )
    return measureScheduleQuality(rounds, previewSlotCount)
  }, [previewSeed, filledNameCount, slotCount, isDuos])
  const duoGameCount = isDuos ? duoGameCountFromCourtCount(courtCount) : undefined
  const ruleChips = useMemo(
    () =>
      sessionRuleChips({ kind: 'preset', mode: playerMode }, t, {
        skillLevel,
        gender,
        gameCount: duoGameCount,
        courtCount,
      }),
    [playerMode, t, skillLevel, gender, duoGameCount, courtCount],
  )
  const courtCaption = useMemo(() => {
    const players = playersFromCourtCount(courtCount)
    if (isDuos) {
      return t('competition.courtsTeamsPlayers', {
        courts: courtCount,
        teams: teamsFromCourtCount(courtCount),
        players,
      })
    }
    return t('competition.courtsPlayers', { courts: courtCount, players })
  }, [courtCount, isDuos, t])

  return (
    <form
      className="w-full min-w-0 space-y-3 pb-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Link to="/competitive" className="text-sm font-medium text-brand-accent">
        ← Back
      </Link>

      <SetupCard ruleChips={ruleChips}>
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {t('competition.formatLabel')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={playerMode === 'singles'}
              onClick={() => {
                setPlayerMode('singles')
                applyCourtCount(courtCount)
              }}
            >
              {t('competition.formatSingles')}
            </Chip>
            <Chip
              active={playerMode === 'duos'}
              onClick={() => {
                setPlayerMode('duos')
                applyCourtCount(courtCount)
              }}
            >
              {t('competition.formatDuos')}
            </Chip>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {t('competition.courts')}
          </span>
          <div
            className={`flex flex-wrap gap-1.5 ${competitionStarted ? 'pointer-events-none opacity-60' : ''}`}
          >
            {COURT_COUNT_OPTIONS.map((n) => (
              <Chip
                key={n}
                active={courtCount === n}
                onClick={() => {
                  if (!competitionStarted) applyCourtCount(n)
                }}
              >
                {n}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-brand-muted">{courtCaption}</p>
        </div>

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

        {showDateFields ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="block min-w-0 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Day
              </span>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="brand-input h-11"
              />
            </label>

            <label className="block min-w-0 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Start
              </span>
              <select
                value={formatHourLabel(startHour, startMinute)}
                onChange={(e) => {
                  const { hour, minute } = parseCompetitionStartSlotValue(e.target.value)
                  setStartHour(hour)
                  setStartMinute(minute)
                }}
                className="brand-input h-11"
              >
                {competitionStartSlots.map((slot) => (
                  <option key={slot.label} value={slot.label}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="text-xs text-brand-muted">{t('competition.leagueDatesLater')}</p>
        )}

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
            placeholder={autoTitle}
            className="brand-input"
          />
        </label>

        <div className="border-t border-brand-border/40 pt-3" />

        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
            {isDuos ? t('competition.duoTeams') : t('competition.playerNames')}
          </p>
          <p className="text-xs text-brand-muted">{t('competition.rosterBlankSlotsOk')}</p>
        </div>
        {!rosterHydrated && id ? (
          <p className="text-sm text-brand-muted">{t('common.loading')}</p>
        ) : isDuos ? (
          <DuoTeamSlots
            teams={duoTeams}
            profiles={profiles}
            padelPlayers={padelPlayers}
            onChange={setDuoTeams}
            disabled={busy}
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
          />
        )}

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
          className="brand-btn w-full py-2.5 text-sm font-semibold disabled:opacity-50"
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
