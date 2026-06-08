import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { parseScoreField, scoreDigitsOnly } from '../lib/competitionScoreInput'
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
  savedPlayedAt?: string
  savedWinner?: MatchTeam
  canLog: boolean
  showMargin: boolean
  compact?: boolean
  large?: boolean
  scoresOnly?: boolean
  inline?: boolean
  stacked?: boolean
  onSaved: () => void
  onScoreChange?: (roundId: string, courtId: string, teamA: number, teamB: number) => void
}

function PickButton({
  selected,
  onClick,
  large,
  children,
}: {
  selected: boolean
  onClick: () => void
  large?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border-2 font-medium transition-colors ${
        large ? 'px-4 py-5 text-xl' : 'px-3 py-3 text-sm'
      } ${
        selected
          ? 'border-brand-accent bg-brand-accent/15 text-brand-primary'
          : 'border-brand-border bg-brand-bg text-brand-text'
      }`}
    >
      {children}
    </button>
  )
}

function TeamNames({ names, large }: { names: string; large?: boolean }) {
  const parts = names.split(' · ')
  if (large && parts.length > 1) {
    return (
      <div className="min-w-0 flex-1 space-y-1">
        {parts.map((name) => (
          <p key={name} className="text-2xl font-semibold leading-tight text-brand-text">
            {name}
          </p>
        ))}
      </div>
    )
  }
  return (
    <span
      className={`min-w-0 flex-1 leading-snug text-brand-text ${
        large ? 'text-2xl font-semibold' : 'text-base'
      }`}
    >
      {names}
    </span>
  )
}

function scoreFieldLabel(scoreUnit: AmericanoScoringUnit): string {
  if (scoreUnit === 'sets') return 'Sets'
  if (scoreUnit === 'open') return 'Score'
  return 'Pts'
}

function TeamPointsRow({
  names,
  value,
  onChange,
  scoreUnit = 'points',
  large = false,
}: {
  names: string
  value: string
  onChange: (v: string) => void
  scoreUnit?: AmericanoScoringUnit
  large?: boolean
}) {
  const fieldLabel = scoreFieldLabel(scoreUnit)
  return (
    <div className={`flex items-center ${large ? 'gap-4' : 'gap-3'}`}>
      <TeamNames names={names} large={large} />
      <div className={`flex shrink-0 items-center ${large ? 'gap-3' : 'gap-2'}`}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(scoreDigitsOnly(e.target.value))}
          className={`rounded-lg border border-brand-border bg-brand-bg text-center font-semibold tabular-nums text-brand-primary ${
            large ? 'w-24 px-3 py-4 text-4xl' : 'w-[4.5rem] px-2 py-2 text-xl'
          }`}
          aria-label={`${fieldLabel} for ${names}`}
        />
        <span
          className={`font-semibold text-brand-muted ${large ? 'text-xl' : 'text-base'}`}
        >
          {fieldLabel}
        </span>
      </div>
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
  large = false,
  scoresOnly = false,
  inline = false,
  stacked = false,
  onSaved,
  onScoreChange,
}: Props) {
  const [winner, setWinner] = useState<MatchTeam | null>(savedWinner ?? null)
  const [teamAPoints, setTeamAPoints] = useState('')
  const [teamBPoints, setTeamBPoints] = useState('')
  const [marginBonus, setMarginBonus] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (dirtyRef.current) return
    if (isAmericano) {
      setTeamAPoints(savedTeamAPoints != null ? String(savedTeamAPoints) : '')
      setTeamBPoints(savedTeamBPoints != null ? String(savedTeamBPoints) : '')
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

  const markDirty = (setter: (v: string) => void) => (v: string) => {
    dirtyRef.current = true
    setter(v)
  }

  const setOurValue = markDirty((v: string) =>
    playerTeam === 'b' ? setTeamBPoints(v) : setTeamAPoints(v),
  )
  const setTheirValue = markDirty((v: string) =>
    playerTeam === 'b' ? setTeamAPoints(v) : setTeamBPoints(v),
  )

  const parsedA = parseScoreField(teamAPoints)
  const parsedB = parseScoreField(teamBPoints)
  const target = playTo ?? (scoreUnit === 'sets' ? 4 : 24)
  const sumLabel = scoreUnit === 'sets' ? 'Sets' : 'Scores'
  const scoresValid = parsedA !== null && parsedB !== null
  const sumMatches = scoresValid && parsedA + parsedB === target
  const readyToSave = scoresValid
  const differsFromSaved =
    savedTeamAPoints !== parsedA || savedTeamBPoints !== parsedB

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
      else {
        dirtyRef.current = false
        onScoreChange?.(roundId, courtId, a, b)
        onSaved()
      }
    },
    [courtId, marginBonus, onSaved, onScoreChange, roundId],
  )

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

  const scoreInputs = isAmericano && scoresOnly && (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={teamAPoints}
        onChange={(e) => markDirty(setTeamAPoints)(scoreDigitsOnly(e.target.value))}
        className="w-10 rounded-lg border border-brand-border bg-brand-bg px-1 py-1.5 text-center text-sm font-semibold tabular-nums text-brand-primary"
        aria-label={`Team A ${scoreUnit === 'sets' ? 'sets' : 'points'}`}
      />
      <span className="text-[10px] text-brand-muted">–</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={teamBPoints}
        onChange={(e) => markDirty(setTeamBPoints)(scoreDigitsOnly(e.target.value))}
        className="w-10 rounded-lg border border-brand-border bg-brand-bg px-1 py-1.5 text-center text-sm font-semibold tabular-nums text-brand-primary"
        aria-label={`Team B ${scoreUnit === 'sets' ? 'sets' : 'points'}`}
      />
    </div>
  )

  if (inline && isAmericano && scoresOnly) {
    const unit = scoreUnit === 'sets' ? 'sets' : 'points'
    const fieldLabel = scoreFieldLabel(scoreUnit)
    const teamRow = (
      names: string[],
      value: string,
      onChange: (v: string) => void,
      side: 'a' | 'b',
    ) => (
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-base font-medium text-brand-text">{names[0]}</p>
          <p className="truncate text-base font-medium text-brand-text">{names[1]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => onChange(scoreDigitsOnly(e.target.value))}
            className="w-12 rounded border border-brand-border bg-brand-bg px-1 py-1.5 text-center text-base font-semibold tabular-nums text-brand-primary"
            aria-label={`Team ${side.toUpperCase()} ${unit}`}
          />
          <span className="text-sm font-semibold text-brand-muted">{fieldLabel}</span>
        </div>
      </div>
    )

    const stackedBody = stacked ? (
      <div className="space-y-1">
        {teamRow(teamA, teamAPoints, markDirty(setTeamAPoints), 'a')}
        <p className="text-center text-[9px] font-medium text-brand-muted">vs</p>
        {teamRow(teamB, teamBPoints, markDirty(setTeamBPoints), 'b')}
      </div>
    ) : (
      canLog && scoreInputs
    )

    return (
      <>
        {canLog ? stackedBody : savedScore ? (
          stacked ? (
            <div className="space-y-1 text-[10px] text-brand-accent">
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate">{teamA[0]}</p>
                  <p className="truncate">{teamA[1]}</p>
                </div>
                <span className="w-8 text-center font-semibold tabular-nums">
                  {savedTeamAPoints ?? '—'}
                </span>
              </div>
              <p className="text-center text-[9px] font-medium text-brand-muted">vs</p>
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate">{teamB[0]}</p>
                  <p className="truncate">{teamB[1]}</p>
                </div>
                <span className="w-8 text-center font-semibold tabular-nums">
                  {savedTeamBPoints ?? '—'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-[10px] font-medium text-brand-accent">{savedScore}</p>
          )
        ) : null}
        {canLog && busy && <p className="text-center text-[10px] text-brand-muted">Saving…</p>}
        {canLog && scoreUnit === 'points' && scoresValid && !sumMatches && (
          <p className="text-center text-[10px] text-red-600">
            {sumLabel} must add up to {target}
          </p>
        )}
        {canLog && isAmericano && (
          <button
            type="button"
            disabled={busy || !readyToSave || !differsFromSaved}
            onClick={() => {
              if (parsedA === null || parsedB === null) return
              void saveAmericano(parsedA, parsedB)
            }}
            className="brand-btn w-full py-2 text-xs disabled:opacity-50"
          >
            {busy ? 'Saving…' : savedScore ? 'Update score' : 'Submit score'}
          </button>
        )}
        {error && <p className="text-center text-[10px] text-red-600">{error}</p>}
      </>
    )
  }

  return (
    <div className={compact ? 'space-y-3' : 'game-card space-y-3 px-3 py-3'}>
      {!compact && !isAmericano && (
        <>
          <p className="text-xl font-semibold text-brand-primary">{courtName}</p>
          <p className="text-lg text-brand-text">
            <span className="text-brand-muted">A:</span> {teamALabel}
          </p>
          <p className="text-lg text-brand-text">
            <span className="text-brand-muted">B:</span> {teamBLabel}
          </p>
        </>
      )}

      {savedScore && <p className="text-xs text-brand-accent">Logged: {savedScore}</p>}

      {canLog && (
        <div
          className={`${large ? 'space-y-5' : 'space-y-3'} ${compact ? '' : 'border-t border-brand-border/50 pt-3'}`}
        >
          {isAmericano ? (
            <>
              <div
                className={
                  scoresOnly
                    ? 'flex items-center justify-center gap-1.5'
                    : large
                      ? 'space-y-5'
                      : 'space-y-3'
                }
              >
                {scoresOnly ? (
                  scoreInputs
                ) : playerTeam ? (
                  <>
                    <TeamPointsRow
                      names={ourLabel}
                      value={ourValue}
                      onChange={setOurValue}
                      scoreUnit={scoreUnit}
                      large={large}
                    />
                    {large && (
                      <p className="text-center text-lg font-bold uppercase tracking-wide text-brand-muted">
                        vs
                      </p>
                    )}
                    <TeamPointsRow
                      names={theirLabel}
                      value={theirValue}
                      onChange={setTheirValue}
                      scoreUnit={scoreUnit}
                      large={large}
                    />
                  </>
                ) : (
                  <>
                    <TeamPointsRow
                      names={teamALabel}
                      value={teamAPoints}
                      onChange={markDirty(setTeamAPoints)}
                      scoreUnit={scoreUnit}
                      large={large}
                    />
                    <TeamPointsRow
                      names={teamBLabel}
                      value={teamBPoints}
                      onChange={markDirty(setTeamBPoints)}
                      scoreUnit={scoreUnit}
                      large={large}
                    />
                  </>
                )}
              </div>
              {scoreUnit === 'points' && scoresValid && !sumMatches && (
                <p className={`text-red-600 ${large ? 'text-base' : 'text-xs'}`}>
                  {sumLabel} must add up to {target}
                </p>
              )}
              <button
                type="button"
                disabled={busy || !readyToSave || !differsFromSaved}
                onClick={() => {
                  if (parsedA === null || parsedB === null) return
                  void saveAmericano(parsedA, parsedB)
                }}
                className="brand-btn w-full py-2.5 text-sm disabled:opacity-50"
              >
                {busy ? 'Saving…' : savedScore ? 'Update score' : 'Submit score'}
              </button>
            </>
          ) : (
            <div className={large ? 'space-y-3' : 'space-y-1'}>
              <p
                className={`font-semibold uppercase tracking-wide text-brand-muted ${
                  large ? 'text-sm' : 'text-[10px]'
                }`}
              >
                Who won?
              </p>
              <div className="flex gap-2">
                <PickButton large={large} selected={winner === 'a'} onClick={() => setWinner('a')}>
                  {teamALabel}
                </PickButton>
                <PickButton large={large} selected={winner === 'b'} onClick={() => setWinner('b')}>
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
          {error && <p className={`text-red-600 ${large ? 'text-base' : 'text-xs'}`}>{error}</p>}
        </div>
      )}
    </div>
  )
}
