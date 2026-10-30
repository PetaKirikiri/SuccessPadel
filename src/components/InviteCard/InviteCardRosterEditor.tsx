import { HalloweenCostumeInput } from './HalloweenCostumeInput'
import { useHalloweenCostumes } from '../../hooks/useHalloweenCostumes'
import { competitionSkin } from '../../lib/competitionSkin'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DuoTeamSlots } from '../../components/SetupCard/SetupCardTeamSlots'
import { MemberPlayerSlots, type PadelPlayerOption } from '../../components/SetupCard/MemberPlayerSlots'
import { useTranslation } from '../../hooks/useTranslation'
import { clubDisplayName } from '../../lib/clubMemberDisplay'
import type { DuoTeamDraft } from '../../lib/competitionDuoTeams'
import { duoTeamDraftsFromRow, competitionRosterSlots, competitionDuoTeamSlots } from '../../lib/competitionGameDisplay'
import { isDuoCompetition } from '../../lib/competitionFormatPresets'
import {
  clearInviteRosterDraft,
} from '../../lib/competitionInviteRosterDraft'
import {
  saveCompetitionInviteDuoRoster,
  saveCompetitionInviteSinglesRoster,
} from '../../lib/saveCompetitionInviteRoster'
import { supabase } from '../../lib/supabaseClient'
import { inviteRosterDirectory, type RosterProfileOption as Profile } from '../../lib/inviteRosterDirectory'
import type { CompetitionRow } from '../../hooks/useCompetitions'
import { useCompetitionAttendance } from '../../hooks/useCompetitionAttendance'
import { rosterDisplayName } from '../../hooks/useCompetitions'
import { useCompetitionLineupDrag } from '../../hooks/useCompetitionLineupDrag'
import { savePublicCompetitionSignup, savePublicInviteOrder } from '../../lib/publicCompetitionSignup'

type Props = {
  row: CompetitionRow
  onSaved?: () => void
  publicSignup?: boolean
}

const FLUSH_MS = 600

function padArray<T>(values: T[], count: number, fill: T): T[] {
  const next = values.slice(0, count)
  while (next.length < count) next.push(fill)
  return next
}

type PadelPlayerRow = Omit<PadelPlayerOption, 'profiles'> & {
  profiles?: PadelPlayerOption['profiles'] | PadelPlayerOption['profiles'][]
}

function normalizePadelPlayers(rows: PadelPlayerRow[] | null): PadelPlayerOption[] {
  return (rows ?? []).map((row) => ({
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null,
  }))
}

function singlesFromRow(row: CompetitionRow) {
  const slots = competitionRosterSlots(row)
  return {
    names: slots.map((slot) => slot.name),
    profileIds: slots.map((slot) => slot.profileId),
    padelPlayerIds: slots.map((slot) => slot.padelPlayerId ?? null),
    slotCount: slots.length,
  }
}

function draftFromRow(row: CompetitionRow, isDuos: boolean) {
  if (isDuos) {
    return { isDuos: true as const, duoTeams: duoTeamDraftsFromRow(row) }
  }
  const singles = singlesFromRow(row)
  return {
    isDuos: false as const,
    playerSlots: singles.names,
    profileIds: singles.profileIds,
    padelPlayerIds: singles.padelPlayerIds,
    slotCount: singles.slotCount,
  }
}

function resolveLinkedSlotName(
  storedName: string,
  profileId: string | null,
  padelPlayerId: string | null,
  profileById: Map<string, Profile>,
  playerById: Map<string, PadelPlayerOption>,
): string {
  const profile = profileId ? profileById.get(profileId) : undefined
  if (profileId && profile?.display_name?.trim()) {
    return clubDisplayName(profileId, profile.display_name)
  }
  const player = padelPlayerId ? playerById.get(padelPlayerId) : undefined
  if (player?.profile_id && player.profiles?.display_name?.trim()) {
    return clubDisplayName(player.profile_id, player.profiles.display_name)
  }
  if (padelPlayerId && player?.display_name?.trim()) {
    return player.display_name
  }
  return storedName
}

function refreshDuoTeamNames(
  teams: DuoTeamDraft[],
  profiles: Profile[],
  padelPlayers: PadelPlayerOption[],
): DuoTeamDraft[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const playerById = new Map(padelPlayers.map((player) => [player.id, player]))
  return teams.map((team) => ({
    ...team,
    names: [0, 1].map((side) =>
      resolveLinkedSlotName(
        team.names[side],
        team.profileIds[side],
        team.padelPlayerIds[side],
        profileById,
        playerById,
      ),
    ) as [string, string],
  }))
}

function refreshSinglesNames(
  names: string[],
  profileIds: (string | null)[],
  padelPlayerIds: (string | null)[],
  profiles: Profile[],
  padelPlayers: PadelPlayerOption[],
): string[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const playerById = new Map(padelPlayers.map((player) => [player.id, player]))
  return names.map((name, index) =>
    resolveLinkedSlotName(
      name,
      profileIds[index] ?? null,
      padelPlayerIds[index] ?? null,
      profileById,
      playerById,
    ),
  )
}

async function loadRosterDirectory(publicSignup = false) {
  if (publicSignup) {
    const { data, error } = await supabase.from('public_member_directory')
      .select('id, display_name, avatar_url').order('display_name')
    if (error) throw error
    return { profiles: (data ?? []) as Profile[], padelPlayers: [] as PadelPlayerOption[] }
  }
  const [profilesRes, playersRes] = await Promise.all([
    supabase.from('profiles').select('id, display_name, avatar_url').order('display_name'),
    supabase
      .from('padel_players')
      .select(
        'id, display_name, profile_id, line_picture_url, profiles(id, display_name, avatar_url)',
      )
      .order('display_name'),
  ])
  return {
    profiles: (profilesRes.data as Profile[]) ?? [],
    padelPlayers: normalizePadelPlayers(playersRes.data as PadelPlayerRow[] | null),
  }
}

export function InviteCardRosterEditor({ row, onSaved, publicSignup = false }: Props) {
  const { t } = useTranslation()
  const isDuos = isDuoCompetition(row)
  const sessionId = row.id
  const halloween = competitionSkin(row.title) === 'halloween'
  // Presentation follows the saved mixed draw groups, never names or profile guesses.
  const mixedGroups = row.scoring_config?.operation_format === 'mixed-americano'
    ? row.scoring_config.mixed_groups ?? [] : undefined
  const mixedSides = !isDuos && mixedGroups?.length === 2 && mixedGroups.every(group => group.length === 8)
    ? new Map(mixedGroups.flatMap((group, side) => group.map(id => [id, side === 0 ? 'men' : 'women'] as const)))
    : undefined
  const mixedSideBySlot = new Map((row.session_players ?? []).map(player =>
    [player.rank_order, mixedSides?.get(player.id)]))
  const showMixedSides = mixedSides?.size === 16 && (row.session_players ?? []).length === 16 &&
    [...mixedSideBySlot.values()].every(Boolean)

  const [editing, setEditing] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
  const source = useMemo(() => [...(row.session_players ?? [])].sort((a, b) =>
    (a.rank_order ?? 999) - (b.rank_order ?? 999) || a.id.localeCompare(b.id)), [row.session_players])
  const reorderEnabled = !isDuos && !editing && !nameFocused && row.status === 'open' && !row.competition_started_at
  const lineup = useCompetitionLineupDrag(sessionId, source, reorderEnabled,
    (snapshot, ordered) => savePublicInviteOrder(sessionId, snapshot, ordered), mixedGroups)
  const displayedRow = useMemo(() => !isDuos ? { ...row, session_players: lineup.players } : row,
    [row, isDuos, lineup.players])
  const rosterVersion = (displayedRow.session_players ?? []).map(p => [p.id, p.profile_id, p.padel_player_id, p.guest_name].join(':')).join('|')
  const costumes = useHalloweenCostumes(sessionId, halloween && !lineup.saving && !lineup.draggingId, rosterVersion)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [padelPlayers, setPadelPlayers] = useState<PadelPlayerOption[]>([])
  const rosterDirectory = useMemo(
    () => inviteRosterDirectory(displayedRow.session_players ?? [], profiles, padelPlayers),
    [displayedRow.session_players, profiles, padelPlayers],
  )
  const [duoTeams, setDuoTeams] = useState<DuoTeamDraft[]>(() => duoTeamDraftsFromRow(row))
  const [playerSlots, setPlayerSlots] = useState<string[]>(() => singlesFromRow(row).names)
  const [profileIds, setProfileIds] = useState<(string | null)[]>(() =>
    singlesFromRow(row).profileIds,
  )
  const [padelPlayerIds, setPadelPlayerIds] = useState<(string | null)[]>(() =>
    singlesFromRow(row).padelPlayerIds,
  )
  const [slotCount] = useState(() => singlesFromRow(row).slotCount)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirtyRef = useRef(false)
  const editVersion = useRef(0)
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushingRef = useRef(false)
  const snapshotRef = useRef({
    isDuos,
    duoTeams,
    playerSlots,
    profileIds,
    padelPlayerIds,
  })
  const rowRef = useRef(row)
  const editBaseRow = useRef(row)
  rowRef.current = displayedRow

  useEffect(() => {
    snapshotRef.current = { isDuos, duoTeams, playerSlots, profileIds, padelPlayerIds }
  }, [isDuos, duoTeams, playerSlots, profileIds, padelPlayerIds])

  useEffect(() => {
    let active = true
    void loadRosterDirectory(publicSignup).then(({ profiles: nextProfiles, padelPlayers: nextPadel }) => {
      if (!active) return
      setProfiles(nextProfiles)
      setPadelPlayers(nextPadel)
    }).catch(() => { if (active) setError('Unable to load members. You can still enter a new name.') })
    return () => {
      active = false
    }
  }, [publicSignup])

  useEffect(() => {
    if (publicSignup) return
    const onProfileSynced = () => {
      void loadRosterDirectory().then(({ profiles: nextProfiles, padelPlayers: nextPadel }) => {
        setProfiles(nextProfiles)
        setPadelPlayers(nextPadel)
      })
    }
    window.addEventListener('successpadel:profile-synced', onProfileSynced)
    return () => window.removeEventListener('successpadel:profile-synced', onProfileSynced)
  }, [publicSignup])

  useEffect(() => {
    if (profiles.length === 0 && padelPlayers.length === 0) return
    if (isDuos) {
      setDuoTeams((teams) => refreshDuoTeamNames(teams, profiles, padelPlayers))
      return
    }
    setPlayerSlots((names) =>
      refreshSinglesNames(names, profileIds, padelPlayerIds, profiles, padelPlayers),
    )
  }, [profiles, padelPlayers, isDuos, profileIds, padelPlayerIds])

  useEffect(() => {
    dirtyRef.current = false
    setEditing(false)
    setNameFocused(false)
    clearInviteRosterDraft(sessionId)
    const next = draftFromRow(rowRef.current, isDuos)
    if (next.isDuos) setDuoTeams(next.duoTeams)
    else {
      setPlayerSlots(padArray(next.playerSlots, next.slotCount, ''))
      setProfileIds(padArray(next.profileIds, next.slotCount, null))
      setPadelPlayerIds(padArray(next.padelPlayerIds, next.slotCount, null))
    }
  }, [sessionId, isDuos])

  useEffect(() => {
    if (dirtyRef.current) return
    const next = draftFromRow(displayedRow, isDuos)
    if (next.isDuos) {
      setDuoTeams(next.duoTeams)
    } else {
      setPlayerSlots(padArray(next.playerSlots, next.slotCount, ''))
      setProfileIds(padArray(next.profileIds, next.slotCount, null))
      setPadelPlayerIds(padArray(next.padelPlayerIds, next.slotCount, null))
    }
  }, [displayedRow, isDuos])

  const flushToDb = useCallback(async () => {
    if (!dirtyRef.current || flushingRef.current) return false
    flushingRef.current = true
    setSaving(true)
    setError(null)
    const snap = snapshotRef.current
    const version = editVersion.current
    const err = publicSignup
      ? await savePublicCompetitionSignup(editBaseRow.current,
          snap.isDuos ? snap.duoTeams.flatMap(team => team.names) : snap.playerSlots,
          snap.isDuos ? snap.duoTeams.flatMap(team => team.profileIds.map((id, side) => id ?? team.padelPlayerIds[side])) : snap.profileIds.map((id, slot) => id ?? snap.padelPlayerIds[slot]))
      : snap.isDuos
      ? await saveCompetitionInviteDuoRoster(sessionId, snap.duoTeams)
      : await saveCompetitionInviteSinglesRoster(
          sessionId,
          snap.playerSlots,
          snap.profileIds,
          snap.padelPlayerIds,
        )
    flushingRef.current = false
    setSaving(false)
    if (err) {
      setError(err)
      return false
    }
    dirtyRef.current = editVersion.current !== version
    setEditing(dirtyRef.current)
    clearInviteRosterDraft(sessionId)
    await Promise.resolve(onSaved?.())
    return true
  }, [sessionId, onSaved, publicSignup])

  const noteEdit = useCallback(() => {
    if (!dirtyRef.current) editBaseRow.current = rowRef.current
    editVersion.current += 1
    dirtyRef.current = true
    setEditing(true)
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(() => {
      void flushToDb()
    }, FLUSH_MS)
  }, [flushToDb])

  useEffect(() => {
    if (!saving && dirtyRef.current && !error) {
      const timer = setTimeout(() => { void flushToDb() }, FLUSH_MS)
      return () => clearTimeout(timer)
    }
  }, [saving, error, flushToDb])

  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
    }
  }, [])

  const handleDuoChange = useCallback(
    (teams: DuoTeamDraft[]) => {
      setDuoTeams(teams)
      noteEdit()
    },
    [noteEdit],
  )

  const handleSinglesChange = useCallback(
    (names: string[], ids: (string | null)[], padelIds: (string | null)[]) => {
      const current = snapshotRef.current
      if (
        !current.isDuos &&
        names.every((name, index) => name === current.playerSlots[index]) &&
        ids.every((id, index) => id === current.profileIds[index]) &&
        padelIds.every((id, index) => id === current.padelPlayerIds[index])
      ) {
        return
      }
      setPlayerSlots(names)
      setProfileIds(ids)
      setPadelPlayerIds(padelIds)
      noteEdit()
    },
    [noteEdit],
  )

  const { attendance, busyPlayerId, error: attendanceError, updateAttendance } = useCompetitionAttendance(row.id, !lineup.saving)
  const renderSlotActions = (index: number) => {
    const name = isDuos ? duoTeams[Math.floor(index / 2)]?.names[index % 2] : playerSlots[index]
    const profileId = isDuos ? duoTeams[Math.floor(index / 2)]?.profileIds[index % 2] : profileIds[index]
    const padelId = isDuos ? duoTeams[Math.floor(index / 2)]?.padelPlayerIds?.[index % 2] : padelPlayerIds[index]
    const matches = (displayedRow.session_players ?? []).filter(player =>
      Boolean(name?.trim()) && rosterDisplayName(player).trim() === name?.trim() &&
      (profileId ? player.profile_id === profileId || player.profiles?.id === profileId || player.padel_players?.profile_id === profileId
        : padelId ? player.padel_player_id === padelId : !player.profile_id && !player.padel_player_id))
    const team = isDuos ? competitionDuoTeamSlots(row)[Math.floor(index / 2)] : undefined
    const pair = team?.pairId ? row.session_pairs?.find(item => item.id === team.pairId) : undefined
    const pairPlayerId = index % 2 === 0 ? pair?.roster_a_id : pair?.roster_b_id
    const slotPlayer = pairPlayerId
      ? matches.find(player => player.id === pairPlayerId)
      : matches.find(player => player.rank_order === index)
    const player = slotPlayer ?? (matches.length === 1 ? matches[0] : undefined)
    const status = player ? attendance[player.id] ?? 'pending' : 'pending'
    const disabled = !player || saving || lineup.saving || lineup.draggingId !== null || busyPlayerId !== null || dirtyRef.current
    const respond = (next: 'confirmed' | 'cancelled') => {
      // Blur commits a changed name before this click; never confirm the old occupant.
      if (!player || dirtyRef.current || flushingRef.current) return
      void updateAttendance(player.id, status === next ? 'pending' : next)
    }
    return <div className="invite-signup-attendance" data-mixed-side={showMixedSides ? mixedSideBySlot.get(index) : undefined}
      role="group" aria-label={`${showMixedSides ? `${mixedSideBySlot.get(index)}: ` : ''}${name || 'Empty slot'}: attendance`}>
      <button type="button" className="invite-signup-attendance__yes" disabled={disabled}
        aria-label={`${name || 'Empty slot'}: confirm attendance`} aria-pressed={status === 'confirmed'}
        onClick={() => respond('confirmed')}>Confirm</button>
      <button type="button" className="invite-signup-attendance__no" disabled={disabled}
        aria-label={`${name || 'Empty slot'}: can't play`} aria-pressed={status === 'cancelled'}
        onClick={() => respond('cancelled')}>Can’t play</button>
    </div>
  }

  return (<>
    <div
      className="invite-roster-editor"
      data-mixed-roster={showMixedSides || undefined}
      data-halloween-costumes={halloween || undefined}
      onFocusCapture={event => { if (event.target instanceof HTMLInputElement) setNameFocused(true) }}
      onBlurCapture={event => { if (event.target instanceof HTMLInputElement) setNameFocused(false) }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {isDuos ? (
        <DuoTeamSlots
          renderSlotActions={renderSlotActions}
          disabled={publicSignup && saving}
          teams={duoTeams}
          profiles={rosterDirectory.profiles}
          padelPlayers={rosterDirectory.padelPlayers}
          onChange={handleDuoChange}
          layout="grid"
          nameInputMode="picker"
          linkAvatarsToProfile
          competitionId={sessionId}
          inviteChipLayout
        />
      ) : (
        <MemberPlayerSlots
          renderSlotDetails={halloween ? index => {
            const rosterId = displayedRow.session_players?.find(p => p.rank_order === index)?.id
            const costume = costumes.records.find(c => c.roster_id === rosterId)
            const named = Boolean(playerSlots[index]?.trim()) && !/^(Open place \d+|Player)$/.test(playerSlots[index].trim())
            return costume && costumes.canEdit ? <HalloweenCostumeInput key={costume.subject_key} sessionId={sessionId}
              costume={costume} token={costumes.token} disabled={!named || saving || lineup.saving || lineup.draggingId !== null || dirtyRef.current} />
              : <div className="halloween-costume-field"><input aria-label={`Halloween costume for ${playerSlots[index] || 'player'}`}
                  placeholder="Halloween costume…" title="Owner access required to edit costumes" disabled /></div>
          } : undefined}
          renderSlotActions={renderSlotActions}
          disabled={saving || lineup.saving || lineup.draggingId !== null}
          lineup={{ ...lineup, enabled: reorderEnabled && busyPlayerId === null, slotIds: Array.from({ length: slotCount }, (_, index) =>
            lineup.players.find(p => p.rank_order === index)?.id ?? null) }}
          count={slotCount}
          profiles={rosterDirectory.profiles}
          padelPlayers={rosterDirectory.padelPlayers}
          names={playerSlots}
          profileIds={profileIds}
          padelPlayerIds={padelPlayerIds}
          onChange={handleSinglesChange}
          showMembers
          showPlayerProfiles
          nameInputMode="picker"
          linkAvatarsToProfile
          competitionId={sessionId}
          showSlotNumbers
          inviteChipLayout
        />
      )}
      {costumes.error && halloween ? <p role="alert">{costumes.error}</p> : null}
      {attendanceError ? <p role="alert">{attendanceError}</p> : null}
      {!isDuos ? <p className="competition-pregame__lineup-status" role="status" aria-live="polite">{lineup.saving ? 'Saving order…' : lineup.message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {saving ? <p className="sr-only">{t('common.loading')}</p> : null}
    </div></>
  )
}
