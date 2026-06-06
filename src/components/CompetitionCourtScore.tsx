import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import type { MatchTeam } from '../lib/types'
import { supabase } from '../lib/supabaseClient'

type Props = {
  roundId: string
  courtId: string
  courtName: string
  teamA: string[]
  teamB: string[]
  playerTeam?: MatchTeam
  isAmericano?: boolean
  playTo?: number
  scoreUnit?: AmericanoScoringUnit
  savedScore?: string
  savedTeamAPoints?: number
  savedTeamBPoints?: number
  savedWinner?: MatchTeam
  canLog: boolean
  showMargin: boolean
  compact?: boolean
  onSaved: () => void
}

function PickButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-colors ${
        selected
          ? 'border-brand-accent bg-brand-accent/15 text-brand-primary'
          : 'border-brand-border bg-brand-bg text-brand-text'
      }`}
    >
      {children}
    </button>
  )
}

function TeamPointsRow({
  names,
  value,
  onChange,
  scoreUnit = 'points',
}: {
  names: string
  value: string
  onChange: (v: string) => void
  scoreUnit?: AmericanoScoringUnit
}) {
  const unitLabel =
    scoreUnit === 'sets' ? 'Sets won' : scoreUnit === 'open' ? 'Score' : 'Points'
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-sm leading-snug text-brand-text">{names}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[4.5rem] shrink-0 rounded-lg border border-brand-border bg-brand-bg px-2 py-2 text-center text-lg font-semibold tabular-nums text-brand-primary"
        aria-label={`${unitLabel} for ${names}`}
      />
    </div>
  )
}

export function CompetitionCourtScore({
  roundId,
  courtId,
  courtName,
  teamA,
  teamB,
  playerTeam,
  isAmericano = false,
  playTo,
  scoreUnit = 'points',
  savedScore,
  savedTeamAPoints,
  savedTeamBPoints,
  savedWinner,
  canLog,
  showMargin,
  compact = false,
  onSaved,
}: Props) {
  const [winner, setWinner] = useState<MatchTeam | null>(savedWinner ?? null)
  const [teamAPoints, setTeamAPoints] = useState('')
  const [teamBPoints, setTeamBPoints] = useState('')
  const [marginBonus, setMarginBonus] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    if (isAmericano) {
      if (savedTeamAPoints != null) setTeamAPoints(String(savedTeamAPoints))
      if (savedTeamBPoints != null) setTeamBPoints(String(savedTeamBPoints))
      return
    }
    if (savedWinner) setWinner(savedWinner)
  }, [isAmericano, savedTeamAPoints, savedTeamBPoints, savedWinner])

  const teamALabel = teamA.join(' · ') || 'Team A'
  const teamBLabel = teamB.join(' · ') || 'Team B'

  const ourLabel = playerTeam === 'b' ? teamBLabel : teamALabel
  const theirLabel = playerTeam === 'b' ? teamALabel : teamBLabel
  const ourValue = playerTeam === 'b' ? teamBPoints : teamAPoints
  const theirValue = playerTeam === 'b' ? teamAPoints : teamBPoints
  const setOurValue = (v: string) => (playerTeam === 'b' ? setTeamBPoints(v) : setTeamAPoints(v))
  const setTheirValue = (v: string) => (playerTeam === 'b' ? setTeamAPoints(v) : setTeamBPoints(v))

  const parsedA = Number(teamAPoints)
  const parsedB = Number(teamBPoints)
  const target = playTo ?? (scoreUnit === 'sets' ? 4 : 24)
  const sumLabel = scoreUnit === 'sets' ? 'Sets' : 'Scores'
  const bothFilled = teamAPoints !== '' && teamBPoints !== ''
  const scoresValid =
    bothFilled &&
    Number.isInteger(parsedA) &&
    Number.isInteger(parsedB) &&
    parsedA >= 0 &&
    parsedB >= 0
  const sumMatches = scoresValid && parsedA + parsedB === target
  const readyToSave = scoreUnit === 'open' ? scoresValid : sumMatches

  const saveAmericano = useCallback(
    async (a: number, b: number) => {
      if (savingRef.current) return
      savingRef.current = true
      setBusy(true)
      setError(null)
      const winTeam: MatchTeam = a >= b ? 'a' : 'b'
      const { error: err } = await supabase.rpc('record_competition_match', {
        p_round_id: roundId,
        p_court_id: courtId,
        p_score_summary: `${a}-${b}`,
        p_winner_team: winTeam,
        p_margin_bonus: marginBonus,
        p_team_a_points: a,
        p_team_b_points: b,
      })
      savingRef.current = false
      setBusy(false)
      if (err) setError(err.message)
      else onSaved()
    },
    [courtId, marginBonus, onSaved, roundId],
  )

  useEffect(() => {
    if (!isAmericano || !canLog || !readyToSave) return
    if (savedTeamAPoints === parsedA && savedTeamBPoints === parsedB) return
    void saveAmericano(parsedA, parsedB)
  }, [
    isAmericano,
    canLog,
    readyToSave,
    parsedA,
    parsedB,
    savedTeamAPoints,
    savedTeamBPoints,
    saveAmericano,
  ])

  const submitWinner = async () => {
    if (!winner) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('record_competition_match', {
      p_round_id: roundId,
      p_court_id: courtId,
      p_score_summary: `${winner === 'a' ? teamALabel : teamBLabel} won`,
      p_winner_team: winner,
      p_margin_bonus: marginBonus,
      p_team_a_points: null,
      p_team_b_points: null,
    })
    setBusy(false)
    if (err) setError(err.message)
    else onSaved()
  }

  return (
    <div className={compact ? 'space-y-3' : 'game-card space-y-3 px-3 py-3'}>
      {!compact && !isAmericano && (
        <>
          <p className="text-sm font-medium text-brand-primary">{courtName}</p>
          <p className="text-sm text-brand-text">
            <span className="text-brand-muted">A:</span> {teamALabel}
          </p>
          <p className="text-sm text-brand-text">
            <span className="text-brand-muted">B:</span> {teamBLabel}
          </p>
        </>
      )}

      {savedScore && <p className="text-xs text-brand-accent">Logged: {savedScore}</p>}

      {canLog && (
        <div className={`space-y-3 ${compact ? '' : 'border-t border-brand-border/50 pt-3'}`}>
          {isAmericano ? (
            <>
              <div className="space-y-3">
                {playerTeam ? (
                  <>
                    <TeamPointsRow
                      names={ourLabel}
                      value={ourValue}
                      onChange={setOurValue}
                      scoreUnit={scoreUnit}
                    />
                    <TeamPointsRow
                      names={theirLabel}
                      value={theirValue}
                      onChange={setTheirValue}
                      scoreUnit={scoreUnit}
                    />
                  </>
                ) : (
                  <>
                    <TeamPointsRow
                      names={teamALabel}
                      value={teamAPoints}
                      onChange={setTeamAPoints}
                      scoreUnit={scoreUnit}
                    />
                    <TeamPointsRow
                      names={teamBLabel}
                      value={teamBPoints}
                      onChange={setTeamBPoints}
                      scoreUnit={scoreUnit}
                    />
                  </>
                )}
              </div>
              {busy && <p className="text-xs text-brand-muted">Saving…</p>}
              {scoreUnit !== 'open' && scoresValid && !sumMatches && (
                <p className="text-xs text-red-600">
                  {sumLabel} must add up to {target}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                Who won?
              </p>
              <div className="flex gap-2">
                <PickButton selected={winner === 'a'} onClick={() => setWinner('a')}>
                  {teamALabel}
                </PickButton>
                <PickButton selected={winner === 'b'} onClick={() => setWinner('b')}>
                  {teamBLabel}
                </PickButton>
              </div>
            </div>
          )}

          {showMargin && (
            <label className="flex items-center gap-2 text-xs text-brand-muted">
              <input
                type="checkbox"
                checked={marginBonus}
                onChange={(e) => setMarginBonus(e.target.checked)}
                className="accent-brand-accent"
              />
              Margin set bonus
            </label>
          )}

          {!isAmericano && (
            <button
              type="button"
              disabled={busy || !winner}
              onClick={() => void submitWinner()}
              className="brand-btn w-full py-2.5 text-sm"
            >
              {busy ? 'Saving…' : savedScore ? 'Update score' : 'Submit score'}
            </button>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
