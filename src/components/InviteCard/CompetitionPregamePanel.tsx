import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CompetitionRow } from '../../hooks/useCompetitions'
import { rosterDisplayName } from '../../hooks/useCompetitions'
import { competitionPlayerAvatarUrl } from '../../lib/competitionRosterAvatars'
import { resolveCompetitionSchedule } from '../../lib/competitionLayout'
import { competitionPlayerMode } from '../../lib/competitionFormatPresets'
import { americanoScoreTarget } from '../../lib/competitionPresets'
import { supabase } from '../../lib/supabaseClient'
import { rulesCopy, rulesLanguages, type RulesLanguage } from '../../lib/competitionRulesLanguages'
import { useCompetitionLineupDrag } from '../../hooks/useCompetitionLineupDrag'
import { useAuth } from '../../hooks/useAuth'
import { PlayerNameLink } from '../../shared/ProfilePhoto/PlayerNameLink'

type AttendanceStatus = 'pending' | 'confirmed' | 'cancelled'
type AttendanceRow = {
  roster_entry_id: string
  status: AttendanceStatus
}

type Props = {
  row: CompetitionRow
  view?: 'players' | 'rules' | 'overview'
  rosterContent?: ReactNode
  canReorder?: boolean
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

export function CompetitionPregamePanel({ row, view = 'players', canReorder = false, rosterContent }: Props) {
  const { user, profile, loading: authLoading } = useAuth()
  const [language, setLanguage] = useState<RulesLanguage>(() => {
    try {
      const saved = localStorage.getItem('success-padel:rules-language')
      return rulesLanguages.find((item) => item.id === saved)?.id ?? 'en'
    } catch { return 'en' }
  })
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const roster = useMemo(
    () => [...(row.session_players ?? [])].sort((a, b) => (a.rank_order ?? 999) - (b.rank_order ?? 999)),
    [row.session_players],
  )
  const schedule = resolveCompetitionSchedule(row)
  const mode = competitionPlayerMode(row.scoring_config)
  const recognizedAdmin = !authLoading && Boolean(user?.id && profile?.id === user.id && profile?.is_admin)
  const reorderEnabled = canReorder && recognizedAdmin && mode !== 'duos'
  const lineup = useCompetitionLineupDrag(row.id, roster, reorderEnabled && busyPlayerId === null)
  const scoreTarget = americanoScoreTarget(row)
  const copy = rulesCopy[language]
  const translate = (text: string) => text
    .replaceAll('{target}', String(scoreTarget))
    .replaceAll('{minutes}', String(schedule.gameMinutes))
    .replaceAll('{rounds}', String(schedule.totalGames))
  const steps = [...copy.steps.slice(0, 4), mode === 'duos' ? copy.duos : copy.rotation, copy.steps[4]]
  const chooseLanguage = (next: RulesLanguage) => {
    setLanguage(next)
    try { localStorage.setItem('success-padel:rules-language', next) } catch { /* Selection still works without storage. */ }
  }

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
    const previousStatus = attendance[rosterEntryId] ?? 'pending'
    const nextStatus: AttendanceStatus = attendance[rosterEntryId] === 'confirmed' ? 'pending' : 'confirmed'
    setBusyPlayerId(rosterEntryId)
    setError(null)
    setAttendance((current) => {
      const next = { ...current, [rosterEntryId]: nextStatus }
      return next
    })
    try {
      const { error: updateError } = await supabase.rpc('set_competition_attendance', {
        p_session_id: row.id,
        p_roster_entry_id: rosterEntryId,
        p_status: nextStatus,
      })
      if (updateError) throw updateError
      setAttendance((current) => {
        const next = { ...current, [rosterEntryId]: nextStatus }
        writeLocalAttendance(row.id, next)
        return next
      })
    } catch (cause) {
      setAttendance((current) => ({ ...current, [rosterEntryId]: previousStatus }))
      const message = cause && typeof cause === 'object' && 'message' in cause
        ? String(cause.message) : 'Check your connection and try again.'
      setError(`Attendance was not saved: ${message}`)
    } finally {
      setBusyPlayerId(null)
    }
  }

  return (
    <div className="competition-pregame">
      {view !== 'rules' && <section id={`players-${row.id}`} className="competition-pregame__players" aria-label="Player attendance">
        {rosterContent ?? <>
        {reorderEnabled && <p className="competition-pregame__lineup-status" role="status" aria-live="polite">{lineup.message}</p>}
        <ol className="competition-pregame__roster" aria-busy={lineup.saving}>
          {lineup.players.map((player, index) => {
            const name = rosterDisplayName(player)
            const avatar = competitionPlayerAvatarUrl(player)
            const status = attendance[player.id] ?? 'pending'
            return (
              <li className={`competition-pregame__player competition-pregame__player--${status}`} key={player.id}
                data-lineup-player={player.id} data-lineup-session={row.id} data-drop-target={lineup.targetId === player.id}
                data-reorder-enabled={reorderEnabled} data-dragging={lineup.draggingId === player.id}
                tabIndex={reorderEnabled ? 0 : undefined}
                aria-label={reorderEnabled ? `${name}, position ${index + 1}. Drag this card or use arrow keys to reorder.` : undefined}
                onPointerDown={(event) => lineup.pointerDown(event, index)} onPointerMove={lineup.pointerMove}
                onPointerUp={lineup.pointerUp} onPointerCancel={lineup.cancel}
                onLostPointerCapture={lineup.cancel} onDragStart={(event) => event.preventDefault()}
                onKeyDown={(event) => lineup.keyDown(event, index)}>
                <span className="competition-pregame__rank">{index + 1}</span>
                {avatar ? (
                  <img className="competition-pregame__avatar" src={avatar} alt="" />
                ) : (
                  <span className="competition-pregame__avatar competition-pregame__avatar--initial">{playerInitial(name)}</span>
                )}
                <PlayerNameLink
                  displayName={name}
                  profileId={player.profile_id ?? player.profiles?.id ?? player.padel_players?.profile_id ?? player.padel_players?.profiles?.id}
                  padelPlayerId={player.padel_player_id ?? player.padel_players?.id}
                  competitionId={row.id}
                  className="competition-pregame__name"
                  disabled={lineup.saving || lineup.draggingId !== null}
                />
                <button
                  type="button"
                  className={`competition-pregame__confirm competition-pregame__confirm--${status}`}
                  disabled={busyPlayerId !== null || lineup.saving || lineup.draggingId !== null}
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
        {error ? <p className="competition-pregame__error" role="alert">{error}</p> : null}
        </>}
      </section>}

      {view !== 'players' && <aside id={`tonights-rules-${row.id}`} className="competition-pregame__rules" aria-label={copy.title} lang={language} dir={language === 'he' ? 'rtl' : 'ltr'}>
        <h3 className="competition-pregame__heading">{copy.title}</h3>
        <div className="competition-pregame__languages" role="group" aria-label="Rules language" dir="ltr">
          {rulesLanguages.map((item) => (
            <button type="button" className="competition-pregame__language" key={item.id} lang={item.id}
              aria-pressed={language === item.id} aria-label={item.name} title={item.name}
              onClick={() => chooseLanguage(item.id)}>
              <span aria-hidden="true">{item.flag}</span> {item.name}
            </button>
          ))}
        </div>
        <dl className="competition-pregame__facts">
          <div><dt>{copy.facts[0]}</dt><dd>{copy.formats[mode === 'duos' ? 1 : 0]}</dd></div>
          <div><dt>{copy.facts[1]}</dt><dd>{schedule.totalGames}</dd></div>
          <div><dt>{copy.facts[2]}</dt><dd>{copy.minutes.replace('{n}', String(schedule.gameMinutes))}</dd></div>
          <div><dt>{copy.facts[3]}</dt><dd>{copy.minutes.replace('{n}', String(schedule.breakMinutes))}</dd></div>
        </dl>
        <ol className="competition-pregame__steps">
          {steps.map(([heading, body], index) => (
            <li key={index}><strong>{translate(heading)}</strong><span>{translate(body)}</span></li>
          ))}
        </ol>
      </aside>}
    </div>
  )
}
