import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { DuoTeamSlots } from './DuoTeamSlots'
import { MemberPlayerSlots, type PadelPlayerOption } from './MemberPlayerSlots'
import { useTranslation } from '../hooks/useTranslation'
import type { DuoTeamDraft } from '../lib/competitionDuoTeams'
import { duoTeamDraftsFromRow, competitionRosterSlots } from '../lib/competitionGameDisplay'
import { isDuoCompetition } from '../lib/competitionFormatPresets'
import {
  loadInviteRosterDraft,
  saveInviteRosterDraft,
} from '../lib/competitionInviteRosterDraft'
import {
  saveCompetitionInviteDuoRoster,
  saveCompetitionInviteSinglesRoster,
} from '../lib/saveCompetitionInviteRoster'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'
import type { CompetitionRow } from '../hooks/useCompetitions'

type Props = {
  row: CompetitionRow
}

const CACHE_MS = 250

function padArray<T>(values: T[], count: number, fill: T): T[] {
  const next = values.slice(0, count)
  while (next.length < count) next.push(fill)
  return next
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

export function CompetitionInviteRosterEditor({ row }: Props) {
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
  const [dirty, setDirty] = useState(() => Boolean(loadInviteRosterDraft(sessionId)))
  const [error, setError] = useState<string | null>(null)

  const dirtyRef = useRef(dirty)
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  useEffect(() => {
    dirtyRef.current = false
    setDirty(false)
    const cached = loadInviteRosterDraft(sessionId)
    if (cached?.isDuos && cached.duoTeams) {
      setDuoTeams(cached.duoTeams)
      dirtyRef.current = true
      setDirty(true)
      return
    }
    if (cached && !cached.isDuos && cached.playerSlots) {
      setPlayerSlots(cached.playerSlots)
      setProfileIds(padArray(cached.profileIds ?? [], cached.playerSlots.length, null))
      setPadelPlayerIds(padArray(cached.padelPlayerIds ?? [], cached.playerSlots.length, null))
      dirtyRef.current = true
      setDirty(true)
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
    setDirty(false)
    persistCache()
    return true
  }, [sessionId, persistCache])

  const noteEdit = useCallback(() => {
    dirtyRef.current = true
    setDirty(true)
    persistCache()
  }, [persistCache])

  useEffect(() => {
    return () => {
      if (cacheTimer.current) clearTimeout(cacheTimer.current)
    }
  }, [])

  const handleSubmit = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    void flushToDb()
  }

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
        />
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={saving || !dirty}
        onClick={handleSubmit}
        className="brand-btn mt-3 w-full py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {saving ? t('common.loading') : t('common.submit')}
      </button>
    </div>
  )
}
