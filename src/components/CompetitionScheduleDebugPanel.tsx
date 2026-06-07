import { useMemo, useState } from 'react'
import { measureScheduleQuality, solveBalancedSchedule } from '../lib/balancedSchedule'
import { RANKED_AMERICANO_GAMES } from '../lib/rankedSchedule'
import { compareSchedules } from '../lib/competitionScheduleCompare'
import type { GameRound } from '../lib/americanoSchedule'
import type { LiveCourtRow } from '../lib/competitionScheduleCompare'

type Props = {
  liveCourtsByGame: Map<number, LiveCourtRow[]>
  americanoGames: GameRound[]
  scheduleVersion: number
  started: boolean
  playerCount: number
  courtCount: number
  scheduleSeed: number
  busy?: boolean
  onProposeMatchups?: () => void
  onSaveMatchups?: () => void
}

export function CompetitionScheduleDebugPanel({
  liveCourtsByGame,
  americanoGames,
  scheduleVersion,
  started,
  playerCount,
  courtCount,
  scheduleSeed,
  busy,
  onProposeMatchups,
  onSaveMatchups,
}: Props) {
  const [open, setOpen] = useState(true)
  const summary = useMemo(
    () => compareSchedules(liveCourtsByGame, americanoGames),
    [liveCourtsByGame, americanoGames],
  )

  const mixQuality = useMemo(() => {
    if (playerCount < 4 || playerCount % 4 !== 0) return null
    const rounds = solveBalancedSchedule(playerCount, RANKED_AMERICANO_GAMES, scheduleSeed)
    return measureScheduleQuality(rounds, playerCount)
  }, [playerCount, scheduleSeed])

  const maxUniqueRounds = playerCount >= 4 ? playerCount - 1 : 0
  const repeatsForced = maxUniqueRounds > 0 && maxUniqueRounds < RANKED_AMERICANO_GAMES
  const noRepeatPass = mixQuality != null && mixQuality.repeatPartners === 0
  const noExactPass = mixQuality != null && mixQuality.repeatExactMatches === 0

  const court1Preview = summary.court1Preview.map((line, i) =>
    line ? `G${i + 1}: ${line}` : `G${i + 1}: —`,
  )

  const court1Db = summary.court1Db.map((line, i) =>
    line ? `G${i + 1}: ${line}` : `G${i + 1}: (no DB data)`,
  )

  return (
    <div className="game-card border-2 border-amber-500/40 bg-amber-50/80 px-3 py-3 text-sm dark:bg-amber-950/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left font-semibold text-brand-primary"
      >
        <span>Schedule debug (v{scheduleVersion})</span>
        <span className="text-xs text-brand-muted">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <p>
              <span className="font-semibold">Players:</span> {playerCount} ({courtCount} courts)
            </p>
            <p>
              <span className="font-semibold">Seed:</span> {scheduleSeed}
            </p>
            {mixQuality && (
              <>
                <p className="col-span-2 font-semibold">
                  {noRepeatPass ? (
                    <span className="text-green-700 dark:text-green-400">
                      ✓ No repeat partners
                    </span>
                  ) : (
                    <span className="text-red-600">
                      ✗ {mixQuality.repeatPartners} repeat partner pairing(s)
                      {repeatsForced ? ` (only ${maxUniqueRounds} unique rounds possible for ${playerCount} players)` : ''}
                    </span>
                  )}
                </p>
                <p className="col-span-2 font-semibold">
                  {noExactPass ? (
                    <span className="text-green-700 dark:text-green-400">
                      ✓ No identical matchups
                    </span>
                  ) : (
                    <span className="text-red-600">
                      ✗ {mixQuality.repeatExactMatches} identical matchup(s)
                    </span>
                  )}
                </p>
                <p>
                  <span className="font-semibold">Avg balance gap:</span>{' '}
                  {mixQuality.avgBalanceDiff.toFixed(1)} ranks
                </p>
                <p>
                  <span className="font-semibold">Max balance gap:</span>{' '}
                  {mixQuality.maxBalanceDiff} ranks
                </p>
              </>
            )}
            <p>
              <span className="font-semibold">Started:</span> {started ? 'yes' : 'no'}
            </p>
            <p>
              <span className="font-semibold">DB games:</span> {summary.dbGamesWithData}/8
              {summary.dbGamesWithData === 0 && !started && (
                <span className="font-semibold text-red-600"> — tap Start competition below</span>
              )}
              {summary.dbGamesWithData === 0 && started && (
                <span className="text-red-600"> — tap Refresh court layout</span>
              )}
            </p>
            <p>
              <span className="font-semibold">Court 1 unique (preview):</span>{' '}
              {summary.previewCourt1Unique}/8
            </p>
            <p>
              <span className="font-semibold">Court 1 unique (DB):</span>{' '}
              {summary.dbCourt1Unique}/8
              {summary.dbCourt1Unique < 8 && started && (
                <span className="text-red-600"> — tap Refresh court layout</span>
              )}
            </p>
          </div>

          {summary.duplicateDbCourt1.length > 0 && (
            <p className="text-xs font-semibold text-red-600">
              Duplicate DB Court 1 on games: {summary.duplicateDbCourt1.join(', ')}
            </p>
          )}

          {summary.mismatches.length > 0 && (
            <p className="text-xs font-semibold text-red-600">
              {summary.mismatches.length} DB/preview mismatch(es) — see table below
            </p>
          )}

          {(onProposeMatchups || onSaveMatchups) && (
            <div className="flex flex-wrap gap-2">
              {onProposeMatchups && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onProposeMatchups}
                  className="brand-btn-outline text-xs"
                >
                  {busy ? '…' : 'Propose new matchups'}
                </button>
              )}
              {onSaveMatchups && started && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSaveMatchups}
                  className="brand-btn text-xs"
                >
                  {busy ? '…' : 'Save matchups to DB'}
                </button>
              )}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-brand-muted">Preview (client)</p>
              <ul className="m-0 list-none space-y-1 p-0 font-mono text-xs">
                {court1Preview.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-brand-muted">Database (live)</p>
              <ul className="m-0 list-none space-y-1 p-0 font-mono text-xs">
                {court1Db.length > 0 ? (
                  court1Db.map((line) => <li key={line}>{line}</li>)
                ) : (
                  <li className="text-brand-muted">No round assignments in DB yet</li>
                )}
              </ul>
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded border border-brand-border/60">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-brand-bg">
                <tr>
                  <th className="border-b border-brand-border/60 px-2 py-1">Game</th>
                  <th className="border-b border-brand-border/60 px-2 py-1">Court</th>
                  <th className="border-b border-brand-border/60 px-2 py-1">DB</th>
                  <th className="border-b border-brand-border/60 px-2 py-1">Preview</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr
                    key={`${row.gameNumber}-${row.courtName}`}
                    className={row.db && row.preview && !row.same ? 'bg-red-100/60' : undefined}
                  >
                    <td className="border-b border-brand-border/40 px-2 py-1">{row.gameNumber}</td>
                    <td className="border-b border-brand-border/40 px-2 py-1">{row.courtName}</td>
                    <td className="border-b border-brand-border/40 px-2 py-1 font-mono">
                      {row.db ?? '—'}
                    </td>
                    <td className="border-b border-brand-border/40 px-2 py-1 font-mono">
                      {row.preview ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
