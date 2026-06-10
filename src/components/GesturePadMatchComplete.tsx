import type { MatchTeam } from '../lib/types'
import type { TennisScore } from '../lib/tennisScore'
import type { PlayerGameStats } from '../lib/playerGameStats'
import { useTranslation } from '../hooks/useTranslation'

type Props = {
  score: TennisScore
  winner: MatchTeam
  submitting: boolean
  submitted: boolean
  error: string | null
  savedLocally?: boolean
  playerStats: PlayerGameStats[]
  onSelectPlayer: (stats: PlayerGameStats) => void
  onClose?: () => void
}

export function GesturePadMatchComplete({
  score,
  winner,
  submitting,
  submitted,
  error,
  savedLocally = true,
  playerStats,
  onSelectPlayer,
  onClose,
}: Props) {
  const { t } = useTranslation()
  const winsLabel =
    winner === 'a' ? t('pad.complete.topTeamWins') : t('pad.complete.bottomTeamWins')

  return (
    <div className="pointer-events-auto absolute inset-0 z-[30] flex items-center justify-center bg-black/55 px-4">
      <div
        data-scroll-y
        className="scroll-y max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/30 bg-[#0f3d6e] p-5 text-center shadow-xl"
      >
        <p className="font-display text-2xl font-bold text-white">{t('pad.complete.title')}</p>
        <p className="mt-2 font-display text-4xl font-bold tracking-wide text-white">
          {score.gamesA} – {score.gamesB}
        </p>
        <p className="mt-1 text-sm font-medium text-white/80">{winsLabel}</p>
        {submitting ? (
          <p className="mt-4 text-sm text-white/70">{t('pad.complete.saving')}</p>
        ) : submitted ? (
          <p className="mt-4 text-sm font-semibold text-emerald-300">
            {savedLocally ? t('pad.complete.savedLocal') : t('pad.complete.saved')}
          </p>
        ) : error ? (
          <p className="mt-4 text-sm text-red-300">{error}</p>
        ) : null}

        {playerStats.length > 0 ? (
          <div className="mt-6 text-left">
            <p className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-white/75">
              {t('pad.complete.seeStats')}
            </p>
            <ul className="m-0 list-none space-y-2 p-0">
              {playerStats.map((row) => (
                <li key={row.quadrant}>
                  <button
                    type="button"
                    onClick={() => onSelectPlayer(row)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-left transition hover:bg-white/15 active:bg-white/20"
                  >
                    {row.player.avatarUrl ? (
                      <img
                        src={row.player.avatarUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/40"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
                        {row.displayName[0]?.toUpperCase() ?? '?'}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">{row.displayName}</span>
                      <span className="text-xs text-white/60">
                        {t('pad.complete.shotsSuccess', {
                          count: row.totalShots,
                          rate: row.successRate,
                        })}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-300">
                      {row.successRate}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {onClose && submitted ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-brand-accent px-4 py-3 text-sm font-semibold text-white"
          >
            {t('pad.complete.done')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
