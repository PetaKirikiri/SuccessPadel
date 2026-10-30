import { Grid2X2, Timer, Coffee, Zap, UsersRound, Flag } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { CompetitionPlayer, CompetitionRow } from '../../hooks/useCompetitions'
import { rosterDisplayName } from '../../hooks/useCompetitions'
import { competitionPlayerAvatarUrl } from '../../lib/competitionRosterAvatars'
import { resolveCompetitionSchedule } from '../../lib/competitionLayout'
import { competitionPlayerMode } from '../../lib/competitionFormatPresets'
import { americanoScoreTarget } from '../../lib/competitionPresets'
import { useCompetitionAttendance } from '../../hooks/useCompetitionAttendance'
import { rulesHighlights, rulesCopy, rulesLanguages, type RulesLanguage } from '../../lib/competitionRulesLanguages'
import { useCompetitionLineupDrag } from '../../hooks/useCompetitionLineupDrag'
import { useAuth } from '../../hooks/useAuth'
import { CompetitionRoster } from '../competition-formats/CompetitionRoster'
import type { AttendancePlayer } from '../competition-formats/rosterContract'
import { orderSessionPairsByTeamIndex } from '../../lib/competitionDuoTeams'
import { fixedPairRoster } from '../../lib/competition-formats/duos/roster'

type Props = {
  row: CompetitionRow
  view?: 'players' | 'rules' | 'overview'
  rosterContent?: ReactNode
  canReorder?: boolean
}

export function CompetitionPregamePanel({ row, view = 'players', canReorder = false, rosterContent }: Props) {
  const { user, profile, loading: authLoading } = useAuth()
  const [language, setLanguage] = useState<RulesLanguage>(() => {
    try {
      const saved = localStorage.getItem('success-padel:rules-language')
      return rulesLanguages.find((item) => item.id === saved)?.id ?? 'en'
    } catch { return 'en' }
  })
  const { attendance, busyPlayerId, error, updateAttendance } = useCompetitionAttendance(row.id, !rosterContent)
  const roster = useMemo(
    () => [...(row.session_players ?? [])].sort((a, b) => (a.rank_order ?? 999) - (b.rank_order ?? 999)),
    [row.session_players],
  )
  const schedule = resolveCompetitionSchedule(row)
  const mode = competitionPlayerMode(row.scoring_config)
  const recognizedAdmin = !authLoading && Boolean(user?.id && profile?.id === user.id && profile?.is_admin)
  const reorderEnabled = canReorder && recognizedAdmin && mode !== 'duos'
  const lineup = useCompetitionLineupDrag(row.id, roster, reorderEnabled && busyPlayerId === null, undefined,
    row.scoring_config?.operation_format === 'mixed-americano' ? row.scoring_config.mixed_groups ?? [] : undefined)
  const rosterModel = useMemo(() => {
    if (mode !== 'duos') return { players: lineup.players, teams: [], error: null }
    const ranks = new Map(roster.map((player) => [player.id, player.rank_order ?? 0]))
    const pairs = orderSessionPairsByTeamIndex(row.session_pairs ?? [], ranks, Math.ceil(roster.length / 2))
    return fixedPairRoster(roster, pairs)
  }, [mode, row.session_pairs, roster, lineup.players])
  const attendancePlayer = (player: CompetitionPlayer): AttendancePlayer => ({
    id: player.id,
    name: rosterDisplayName(player),
    avatar: competitionPlayerAvatarUrl(player),
    profileId: player.profile_id ?? player.profiles?.id ?? player.padel_players?.profile_id ?? player.padel_players?.profiles?.id,
    padelPlayerId: player.padel_player_id ?? player.padel_players?.id,
    status: attendance[player.id] ?? 'pending',
  })
  const scoreTarget = americanoScoreTarget(row)
  const copy = rulesCopy[language]
  const highlights = rulesHighlights[language]
  const tiles = [
    { id: 'games', icon: Grid2X2, value: String(schedule.totalGames), label: highlights.games },
    { id: 'duration', icon: Timer, value: String(schedule.gameMinutes), label: highlights.duration },
    { id: 'break', icon: Coffee, value: String(schedule.breakMinutes), label: highlights.break },
    { id: 'golden', icon: Zap, value: '40–40', label: highlights.golden, note: highlights.decider },
    { id: 'partners', icon: UsersRound, value: highlights[mode === 'duos' ? 'fixed' : 'rotate'], label: highlights.partners },
    { id: 'target', icon: Flag, value: String(scoreTarget), label: highlights.target, note: highlights.buzzer },
  ]
  const chooseLanguage = (next: RulesLanguage) => {
    setLanguage(next)
    try { localStorage.setItem('success-padel:rules-language', next) } catch { /* Selection still works without storage. */ }
  }


  return (
    <div className="competition-pregame" data-competition-format={mode}>
      {view !== 'rules' && <section id={`players-${row.id}`} className="competition-pregame__players" aria-label="Player attendance">
        {rosterContent ?? <>
        {rosterModel.error ? <p className="competition-pregame__error" role="alert">{rosterModel.error}</p> : null}
        {reorderEnabled && <p className="competition-pregame__lineup-status" role="status" aria-live="polite">{lineup.message}</p>}
        {mode === 'duos' ? (
          <CompetitionRoster format="duos" sessionId={row.id}
            teams={rosterModel.teams.map(([a, b]) => [attendancePlayer(a), attendancePlayer(b)])}
            busyPlayerId={busyPlayerId} disabled={busyPlayerId !== null}
            onAttendance={updateAttendance} />
        ) : (
          <CompetitionRoster format="singles" sessionId={row.id}
            players={rosterModel.players.map(attendancePlayer)} drag={{ ...lineup, enabled: reorderEnabled }}
            busyPlayerId={busyPlayerId} disabled={busyPlayerId !== null || lineup.saving || lineup.draggingId !== null}
            onAttendance={updateAttendance} />
        )}
        {error ? <p className="competition-pregame__error" role="alert">{error}</p> : null}
        </>}
      </section>}

      {view !== 'players' && <aside id={`tonights-rules-${row.id}`} className="competition-pregame__rules competition-pregame__rules--visual" aria-label={copy.title} lang={language} dir={language === 'he' ? 'rtl' : 'ltr'}>
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
        <ul className="competition-rules__grid">
          {tiles.map(({ id, icon: Icon, value, label, note }) => (
            <li className="competition-rules__tile" data-rule={id} key={id}>
              <Icon className="competition-rules__icon" aria-hidden="true" />
              <strong className="competition-rules__value">{value}</strong>
              <span className="competition-rules__label">{label}</span>
              {note && <span className="competition-rules__note">{note}</span>}
            </li>
          ))}
        </ul>
      </aside>}
    </div>
  )
}
