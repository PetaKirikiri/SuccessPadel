import { useCallback, useEffect, useRef, useState } from 'react'
import { DuoTeamSlots } from './DuoTeamSlots'
import { MemberPlayerSlots, type PadelPlayerOption } from './MemberPlayerSlots'
import type { DuoTeamDraft } from '../lib/competitionDuoTeams'
import { duoTeamDraftsFromRow, competitionRosterSlots } from '../lib/competitionGameDisplay'
import { isDuoCompetition } from '../lib/competitionFormatPresets'
import {
  saveCompetitionInviteDuoRoster,
  saveCompetitionInviteSinglesRoster,
} from '../lib/saveCompetitionInviteRoster'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'
import type { CompetitionRow } from '../hooks/useCompetitions'

type Props = {
  row: CompetitionRow
  onRefresh?: () => void
}

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

export function CompetitionInviteRosterEditor({ row, onRefresh }: Props) {
  const isDuos = isDuoCompetition(row)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [padelPlayers, setPadelPlayers] = useState<PadelPlayerOption[]>([])
  const [duoTeams, setDuoTeams] = useState<DuoTeamDraft[]>(() => duoTeamDraftsFromRow(row))
  const [playerSlots, setPlayerSlots] = useState<string[]>(() => singlesFromRow(row).names)
  const [profileIds, setProfileIds] = useState<(string | null)[]>(
    () => singlesFromRow(row).profileIds,
  )
  const [padelPlayerIds, setPadelPlayerIds] = useState<(string | null)[]>(
    () => singlesFromRow(row).padelPlayerIds,
  )
  const [slotCount] = useState(() => singlesFromRow(row).slotCount)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (busy) return
    if (isDuos) setDuoTeams(duoTeamDraftsFromRow(row))
    else {
      const singles = singlesFromRow(row)
      setPlayerSlots(padArray(singles.names, singles.slotCount, ''))
      setProfileIds(padArray(singles.profileIds, singles.slotCount, null))
      setPadelPlayerIds(padArray(singles.padelPlayerIds, singles.slotCount, null))
    }
  }, [row, isDuos, busy])

  const scheduleSave = useCallback(
    (save: () => Promise<string | null>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void (async () => {
          setBusy(true)
          setError(null)
          const err = await save()
          setBusy(false)
          if (err) setError(err)
          else onRefresh?.()
        })()
      }, 400)
    },
    [onRefresh],
  )

  const handleDuoChange = useCallback(
    (teams: DuoTeamDraft[]) => {
      setDuoTeams(teams)
      scheduleSave(() => saveCompetitionInviteDuoRoster(row.id, teams))
    },
    [row.id, scheduleSave],
  )

  const handleSinglesChange = useCallback(
    (names: string[], ids: (string | null)[], padelIds: (string | null)[]) => {
      setPlayerSlots(names)
      setProfileIds(ids)
      setPadelPlayerIds(padelIds)
      scheduleSave(() =>
        saveCompetitionInviteSinglesRoster(row.id, names, ids, padelIds),
      )
    },
    [row.id, scheduleSave],
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
          disabled={busy}
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
          disabled={busy}
          showMembers
          showPlayerProfiles
        />
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
