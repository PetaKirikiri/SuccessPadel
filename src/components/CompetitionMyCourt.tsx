import { useMemo } from 'react'
import {
  americanoScoringUnit,
  americanoTargetPoints,
  usesAmericanoScoring,
} from '../lib/competitionPresets'
import type { GameSession, MatchTeam } from '../lib/types'
import { CompetitionCourtScore } from './CompetitionCourtScore'
import type { CompetitionRound, CourtMatch, RoundPlayer } from '../hooks/useCompetitionRun'
import { roundPlayerName } from '../hooks/useCompetitionRun'

type Props = {
  userId: string
  session: Pick<GameSession, 'partnership_mode' | 'rules' | 'scoring_config'>
  marginBonus: boolean
  activeRound: CompetitionRound
  courtMatches: CourtMatch[]
  timeLeft: string | null
  eventTimeLeft?: string | null
  onSaved: () => void
}

function myCourtGroup(players: RoundPlayer[], userId: string) {
  const mine = players.find((p) => p.session_players?.profile_id === userId)
  if (!mine) return null

  const courtId = mine.court_id
  const onCourt = players.filter((p) => p.court_id === courtId)
  const partner = onCourt.find((p) => p.team === mine.team && p.roster_entry_id !== mine.roster_entry_id)
  const opponents = onCourt.filter((p) => p.team !== mine.team)

  return {
    courtId,
    courtName: mine.courts?.name ?? 'Court',
    team: mine.team as MatchTeam,
    partner: partner ? roundPlayerName(partner) : '—',
    opponents: opponents.map(roundPlayerName),
    teamA: onCourt.filter((p) => p.team === 'a').map(roundPlayerName),
    teamB: onCourt.filter((p) => p.team === 'b').map(roundPlayerName),
  }
}

export function CompetitionMyCourt({
  userId,
  session,
  marginBonus,
  activeRound,
  courtMatches,
  timeLeft,
  eventTimeLeft,
  onSaved,
}: Props) {
  const court = useMemo(
    () => myCourtGroup(activeRound.competition_round_players ?? [], userId),
    [activeRound, userId],
  )

  if (!court) {
    return (
      <p className="px-3 py-8 text-center text-sm text-brand-muted">You are not on court this round.</p>
    )
  }

  const saved = courtMatches.find(
    (m) => m.competition_round_id === activeRound.id && m.court_id === court.courtId,
  )
  const savedParts = saved?.score_summary?.split('-').map((n) => Number(n.trim()))
  const isAmericano = usesAmericanoScoring(session)
  const urgent =
    timeLeft != null &&
    (() => {
      const [m, s] = timeLeft.split(':').map(Number)
      return (m ?? 0) * 60 + (s ?? 0) <= 120 && timeLeft !== '0:00'
    })()

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          {activeRound.is_final ? 'Final round' : `Round ${activeRound.round_number}`}
        </p>
        {timeLeft != null && (
          <p
            className={`font-display text-5xl font-semibold tabular-nums ${
              urgent ? 'text-amber-600' : 'text-brand-primary'
            }`}
          >
            {timeLeft}
          </p>
        )}
        {eventTimeLeft != null && (
          <p className="text-xs text-brand-muted">Event ends in {eventTimeLeft}</p>
        )}
      </div>

      <div className="game-card space-y-2 px-4 py-5 text-center">
        <p className="font-display text-3xl font-semibold text-brand-primary">{court.courtName}</p>
        <p className="text-base text-brand-text">
          <span className="text-brand-muted">Partner</span> {court.partner}
        </p>
        <p className="text-base text-brand-text">
          <span className="text-brand-muted">Vs</span> {court.opponents.join(' · ') || '—'}
        </p>
      </div>

      {urgent && (
        <p className="text-center text-sm text-amber-700">Enter your score when the game ends.</p>
      )}

      <div className="game-card px-3 py-3">
        <CompetitionCourtScore
          roundId={activeRound.id}
          courtId={court.courtId}
          courtName={court.courtName}
          teamA={court.teamA}
          teamB={court.teamB}
          playerTeam={court.team}
          isAmericano={isAmericano}
          playTo={isAmericano ? americanoTargetPoints(session) : undefined}
          scoreUnit={isAmericano ? americanoScoringUnit(session) : 'points'}
          savedScore={saved?.score_summary}
          savedTeamAPoints={isAmericano ? savedParts?.[0] : undefined}
          savedTeamBPoints={isAmericano ? savedParts?.[1] : undefined}
          savedWinner={saved?.match_players.find((p) => p.is_winner)?.team}
          canLog
          showMargin={marginBonus && !isAmericano}
          compact
          onSaved={onSaved}
        />
      </div>
    </div>
  )
}
