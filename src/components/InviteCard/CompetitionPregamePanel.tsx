import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CompetitionRow } from '../../hooks/useCompetitions'
import { rosterDisplayName } from '../../hooks/useCompetitions'
import { competitionPlayerAvatarUrl } from '../../lib/competitionRosterAvatars'
import { resolveCompetitionSchedule } from '../../lib/competitionLayout'
import { competitionPlayerMode } from '../../lib/competitionFormatPresets'
import { americanoScoreTarget } from '../../lib/competitionPresets'
import { supabase } from '../../lib/supabaseClient'

type AttendanceStatus = 'pending' | 'confirmed' | 'cancelled'
type AttendanceRow = {
  roster_entry_id: string
  status: AttendanceStatus
}

type Props = {
  row: CompetitionRow
}

function playerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'P'
}

function attendanceStorageKey(sessionId: string): string {
  return `success-padel:attendance:${sessionId}`
}

function readLocalAttendance(sessionId: string): Record<string, AttendanceStatus> {
  try {
    return JSON.parse(localStorage.getItem(attendanceStorageKey(sessionId)) ?? '{}') as Record<string, AttendanceStatus>
  } catch {
    return {}
  }
}

function writeLocalAttendance(sessionId: string, attendance: Record<string, AttendanceStatus>): void {
  try {
    localStorage.setItem(attendanceStorageKey(sessionId), JSON.stringify(attendance))
  } catch {
    /* Database persistence remains the primary path. */
  }
}

export function CompetitionPregamePanel({ row }: Props) {
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const roster = useMemo(
    () => [...(row.session_players ?? [])].sort((a, b) => (a.rank_order ?? 999) - (b.rank_order ?? 999)),
    [row.session_players],
  )
  const schedule = resolveCompetitionSchedule(row)
  const mode = competitionPlayerMode(row.scoring_config)
  const scoreTarget = americanoScoreTarget(row)

  useEffect(() => {
    let active = true
    setAttendance(readLocalAttendance(row.id))
    const load = async () => {
      const { data } = await supabase
        .from('competition_attendance')
        .select('roster_entry_id, status')
        .eq('session_id', row.id)
      if (!active || !data) return
      setAttendance((local) => ({
        ...local,
        ...Object.fromEntries(
          (data as AttendanceRow[]).map((item) => [item.roster_entry_id, item.status]),
        ),
      }))
    }
    void load()

    const channel = supabase
      .channel(`competition-attendance:${row.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'competition_attendance', filter: `session_id=eq.${row.id}` },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [row.id])

  const toggleAttendance = async (rosterEntryId: string) => {
    if (busyPlayerId) return
    const nextStatus: AttendanceStatus = attendance[rosterEntryId] === 'confirmed' ? 'pending' : 'confirmed'
    setBusyPlayerId(rosterEntryId)
    setError(null)
    setAttendance((current) => {
      const next = { ...current, [rosterEntryId]: nextStatus }
      writeLocalAttendance(row.id, next)
      return next
    })
    const { error: updateError } = await supabase.rpc('set_competition_attendance', {
      p_session_id: row.id,
      p_roster_entry_id: rosterEntryId,
      p_status: nextStatus,
    })
    setBusyPlayerId(null)
    if (updateError) {
      setError('Confirmed on this device. Shared attendance saving is not connected yet.')
      return
    }
  }

  return (
    <div className="competition-pregame">
      <section className="competition-pregame__players" aria-label="Player attendance">
        <ol className="competition-pregame__roster">
          {roster.map((player, index) => {
            const name = rosterDisplayName(player)
            const avatar = competitionPlayerAvatarUrl(player)
            const status = attendance[player.id] ?? 'pending'
            return (
              <li className={`competition-pregame__player competition-pregame__player--${status}`} key={player.id}>
                <span className="competition-pregame__rank">{index + 1}</span>
                {avatar ? (
                  <img className="competition-pregame__avatar" src={avatar} alt="" />
                ) : (
                  <span className="competition-pregame__avatar competition-pregame__avatar--initial">{playerInitial(name)}</span>
                )}
                <span className="competition-pregame__name">{name}</span>
                <button
                  type="button"
                  className={`competition-pregame__confirm competition-pregame__confirm--${status}`}
                  disabled={busyPlayerId !== null}
                  aria-pressed={status === 'confirmed'}
                  aria-label={`${name}: ${status === 'confirmed' ? 'confirmed' : 'unconfirmed'}. Change attendance.`}
                  onClick={() => void toggleAttendance(player.id)}
                >
                  <span className="competition-pregame__confirm-track" aria-hidden="true">
                    <span className="competition-pregame__confirm-knob" />
                  </span>
                  <span className="competition-pregame__confirm-label">
                    {busyPlayerId === player.id ? 'Saving…' : status === 'confirmed' ? 'Confirmed' : 'Unconfirmed'}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        {error ? <p className="competition-pregame__error">{error}</p> : null}
      </section>

      <aside id={`tonights-rules-${row.id}`} className="competition-pregame__rules" aria-label="Tonight's rules">
        <h3 className="competition-pregame__heading">Tonight's Rules</h3>
        <dl className="competition-pregame__facts">
          <div><dt>Format</dt><dd>{mode === 'duos' ? 'Fixed-pair Duo Americano' : 'Americano rotation'}</dd></div>
          <div><dt>Games</dt><dd>{schedule.totalGames}</dd></div>
          <div><dt>Game time</dt><dd>{schedule.gameMinutes} minutes</dd></div>
          <div><dt>Break</dt><dd>{schedule.breakMinutes} minutes</dd></div>
        </dl>
        <ol className="competition-pregame__steps">
          <li>
            <strong>Find your court.</strong>
            <span>The screen shows your partner, opponents and court for every round.</span>
          </li>
          <li>
            <strong>Play to {scoreTarget} games.</strong>
            <span>Stop when one team reaches {scoreTarget}, or when the {schedule.gameMinutes}-minute timer ends.</span>
          </li>
          <li>
            <strong>Enter games won.</strong>
            <span>For example, enter 6–3—not individual points such as 40–30.</span>
          </li>
          <li>
            <strong>Earn your team’s score.</strong>
            <span>Every player receives the number of games their team won in that round.</span>
          </li>
          <li>
            <strong>{mode === 'duos' ? 'Meet new opponents.' : 'Rotate partners.'}</strong>
            <span>{mode === 'duos' ? 'Your pair stays together while the opposing pair changes.' : 'Your partner and opponents change each round, so everyone plays with different people.'}</span>
          </li>
          <li>
            <strong>Climb the leaderboard.</strong>
            <span>Scores from all {schedule.totalGames} rounds are added together. The highest total wins.</span>
          </li>
        </ol>
        <Link className="competition-pregame__enter" to={`/competitions/${row.id}`}>Open competition</Link>
      </aside>
    </div>
  )
}
