import { useCallback, useEffect, useRef, useState } from 'react'
import { DuoTeamSlots } from '../../components/SetupCard/SetupCardTeamSlots'
import { MemberPlayerSlots, type PadelPlayerOption } from '../../components/SetupCard/MemberPlayerSlots'
import { useTranslation } from '../../hooks/useTranslation'
import { clubDisplayName } from '../../lib/clubMemberDisplay'
import type { DuoTeamDraft } from '../../lib/competitionDuoTeams'
import { duoTeamDraftsFromRow, competitionRosterSlots } from '../../lib/competitionGameDisplay'
import { isDuoCompetition } from '../../lib/competitionFormatPresets'
import {
  clearInviteRosterDraft,
  loadInviteRosterDraft,
  saveInviteRosterDraft,
} from '../../lib/competitionInviteRosterDraft'
import {
  saveCompetitionInviteDuoRoster,
  saveCompetitionInviteSinglesRoster,
} from '../../lib/saveCompetitionInviteRoster'
import { supabase } from '../../lib/supabaseClient'
import type { Profile } from '../../lib/types'
import type { CompetitionRow } from '../../hooks/useCompetitions'

type Props = {
  row: CompetitionRow
  onSaved?: () => void
}

const CACHE_MS = 250
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

async function loadRosterDirectory() {
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

export function InviteCardRosterEditor({ row, onSaved }: Props) {
  const { t } = useTranslation()
  const isDuos = isDuoCompetition(row)
  const sessionId = row.id

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [padelPlayers, setPadelPlayers] = useState<PadelPlayerOption[]>([])
  const [duoTeams, setDuoTeams] = useState<DuoTeamDraft[]>(() => {
    const cached = loadInviteRosterDraft(sessionId)
    if (cached?.isDuos && cached.duoTeams) return cached.duoTeams
    return duoTeamDraftsFromRow(row)
  })
  const [playerSlots, setPlayerSlots] = useState<string[]>(() => {
    const cached = loadInviteRosterDraft(sessionId)
    if (cached && !cached.isDuos && cached.playerSlots) return cached.playerSlots
    return singlesFromRow(row).names
  })
  const [profileIds, setProfileIds] = useState<(string | null)[]>(() => {
    const cached = loadInviteRosterDraft(sessionId)
    if (cached && !cached.isDuos && cached.profileIds) return cached.profileIds
    return singlesFromRow(row).profileIds
  })
  const [padelPlayerIds, setPadelPlayerIds] = useState<(string | null)[]>(() => {
    const cached = loadInviteRosterDraft(sessionId)
    if (cached && !cached.isDuos && cached.padelPlayerIds) return cached.padelPlayerIds
    return singlesFromRow(row).padelPlayerIds
  })
  const [slotCount] = useState(() => singlesFromRow(row).slotCount)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirtyRef = useRef(Boolean(loadInviteRosterDraft(sessionId)))
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  rowRef.current = row

  useEffect(() => {
    snapshotRef.current = { isDuos, duoTeams, playerSlots, profileIds, padelPlayerIds }
  }, [isDuos, duoTeams, playerSlots, profileIds, padelPlayerIds])

  useEffect(() => {
    let active = true
    void loadRosterDirectory().then(({ profiles: nextProfiles, padelPlayers: nextPadel }) => {
      if (!active) return
      setProfiles(nextProfiles)
      setPadelPlayers(nextPadel)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onProfileSynced = () => {
      void loadRosterDirectory().then(({ profiles: nextProfiles, padelPlayers: nextPadel }) => {
        setProfiles(nextProfiles)
        setPadelPlayers(nextPadel)
      })
    }
    window.addEventListener('successpadel:profile-synced', onProfileSynced)
    return () => window.removeEventListener('successpadel:profile-synced', onProfileSynced)
  }, [])

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
    const cached = loadInviteRosterDraft(sessionId)
    if (cached?.isDuos && cached.duoTeams) {
      setDuoTeams(cached.duoTeams)
      dirtyRef.current = true
      return
    }
    if (cached && !cached.isDuos && cached.playerSlots) {
      setPlayerSlots(cached.playerSlots)
      setProfileIds(padArray(cached.profileIds ?? [], cached.playerSlots.length, null))
      setPadelPlayerIds(padArray(cached.padelPlayerIds ?? [], cached.playerSlots.length, null))
      dirtyRef.current = true
      return
    }
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
    const next = draftFromRow(row, isDuos)
    if (next.isDuos) {
      setDuoTeams(next.duoTeams)
    } else {
      setPlayerSlots(padArray(next.playerSlots, next.slotCount, ''))
      setProfileIds(padArray(next.profileIds, next.slotCount, null))
      setPadelPlayerIds(padArray(next.padelPlayerIds, next.slotCount, null))
    }
  }, [row, isDuos])

  const persistCache = useCallback(() => {
    if (cacheTimer.current) clearTimeout(cacheTimer.current)
    cacheTimer.current = setTimeout(() => {
      const snap = snapshotRef.current
      if (snap.isDuos) {
        saveInviteRosterDraft(sessionId, { isDuos: true, duoTeams: snap.duoTeams })
      } else {
        saveInviteRosterDraft(sessionId, {
          isDuos: false,
          playerSlots: snap.playerSlots,
          profileIds: snap.profileIds,
          padelPlayerIds: snap.padelPlayerIds,
        })
      }
    }, CACHE_MS)
  }, [sessionId])

  const flushToDb = useCallback(async () => {
    if (!dirtyRef.current || flushingRef.current) return false
    flushingRef.current = true
    setSaving(true)
    setError(null)
    const snap = snapshotRef.current
    const err = snap.isDuos
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
    dirtyRef.current = false
    clearInviteRosterDraft(sessionId)
    await Promise.resolve(onSaved?.())
    return true
  }, [sessionId, onSaved])

  const noteEdit = useCallback(() => {
    dirtyRef.current = true
    persistCache()
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(() => {
      void flushToDb()
    }, FLUSH_MS)
  }, [persistCache, flushToDb])

  useEffect(() => {
    return () => {
      if (cacheTimer.current) clearTimeout(cacheTimer.current)
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
      setPlayerSlots(names)
      setProfileIds(ids)
      setPadelPlayerIds(padelIds)
      noteEdit()
    },
    [noteEdit],
  )

  return (
    <div
      className="invite-roster-editor"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {isDuos ? (
        <DuoTeamSlots
          teams={duoTeams}
          profiles={profiles}
          padelPlayers={padelPlayers}
          onChange={handleDuoChange}
          layout="grid"
          nameInputMode="text"
          linkAvatarsToProfile
          competitionId={sessionId}
          inviteChipLayout
        />
      ) : (
        <MemberPlayerSlots
          count={slotCount}
          profiles={profiles}
          padelPlayers={padelPlayers}
          names={playerSlots}
          profileIds={profileIds}
          padelPlayerIds={padelPlayerIds}
          onChange={handleSinglesChange}
          showMembers
          showPlayerProfiles
          nameInputMode="text"
          linkAvatarsToProfile
          competitionId={sessionId}
          showSlotNumbers={false}
          inviteChipLayout
        />
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {saving ? <p className="sr-only">{t('common.loading')}</p> : null}
    </div>
  )
}
