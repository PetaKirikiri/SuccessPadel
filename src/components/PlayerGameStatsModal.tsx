import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerGameStats, ShotTypeGroup } from '../lib/playerGameStats'
import { shotTypeLabel } from '../lib/playerGameStats'

const SHOT_TYPES: ShotTypeGroup[] = ['smash', 'volley', 'forehand', 'backhand']

const TAB_SHORT: Record<ShotTypeGroup, string> = {
  smash: 'Smash',
  volley: 'Volley',
  forehand: 'FH',
  backhand: 'BH',
}

function typeSuccess(scored: number, foul: number): number {
  const total = scored + foul
  return total > 0 ? Math.round((scored / total) * 100) : 0
}

function defaultTab(stats: PlayerGameStats): ShotTypeGroup {
  const withData = SHOT_TYPES.filter((t) => {
    const row = stats.byType[t]
    return row.scored + row.foul > 0
  })
  if (withData.length === 0) return 'smash'
  return withData.reduce((best, t) => {
    const bestTotal = stats.byType[best].scored + stats.byType[best].foul
    const tTotal = stats.byType[t].scored + stats.byType[t].foul
    return tTotal > bestTotal ? t : best
  })
}

function ShotTypePanel({
  type,
  scored,
  foul,
}: {
  type: ShotTypeGroup
  scored: number
  foul: number
}) {
  const total = scored + foul
  const pct = typeSuccess(scored, foul)
  const scoredShare = total > 0 ? (scored / total) * 100 : 0

  if (total === 0) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-10 text-center">
        <p className="font-display text-lg font-bold text-white/80">{shotTypeLabel(type)}</p>
        <p className="mt-2 text-sm text-white/50">No {shotTypeLabel(type).toLowerCase()} shots recorded</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/12 bg-black/25 px-5 py-6">
      <p className="text-center font-display text-5xl font-bold tabular-nums text-emerald-300">{pct}%</p>
      <p className="mt-1 text-center text-sm font-medium text-white/60">
        {shotTypeLabel(type)} success rate
      </p>

      <div className="mx-auto mt-6 max-w-xs">
        <div className="h-4 overflow-hidden rounded-full bg-white/10">
          <div className="flex h-full w-full">
            <div className="h-full bg-emerald-400" style={{ width: `${scoredShare}%` }} />
            <div className="h-full bg-rose-400" style={{ width: `${100 - scoredShare}%` }} />
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs font-medium text-white/55">
          <span className="text-emerald-300">Scored {scored}</span>
          <span className="text-rose-300">Foul {foul}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-3 text-center">
          <p className="font-display text-2xl font-bold tabular-nums text-emerald-300">{scored}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">Scored</p>
        </div>
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-3 text-center">
          <p className="font-display text-2xl font-bold tabular-nums text-rose-300">{foul}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">Foul</p>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-white/50">
        {total} {shotTypeLabel(type).toLowerCase()} {total === 1 ? 'shot' : 'shots'} this game
      </p>
    </div>
  )
}

type Props = {
  stats: PlayerGameStats
  onClose: () => void
}

export function PlayerGameStatsModal({ stats, onClose }: Props) {
  const initialTab = useMemo(() => defaultTab(stats), [stats])
  const [tab, setTab] = useState<ShotTypeGroup>(initialTab)
  const judged = stats.scored + stats.fouls
  const row = stats.byType[tab]
  const tabTotal = row.scored + row.foul

  return createPortal(
    <div
      className="fixed inset-0 z-[460] flex items-end justify-center bg-black/60 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 sm:items-center"
      onClick={onClose}
    >
      <div
        data-scroll-y
        className="scroll-y max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/15 bg-gradient-to-b from-[#0c4a8a] to-[#0a3566] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="player-stats-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {stats.player.avatarUrl ? (
              <img
                src={stats.player.avatarUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white/40"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white ring-2 ring-white/40">
                {stats.displayName[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <div className="min-w-0">
              <h2 id="player-stats-title" className="truncate font-display text-xl font-bold text-white">
                {stats.displayName}
              </h2>
              <p className="text-sm text-white/65">Shot breakdown</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full px-2 py-1 text-xl leading-none text-white/70"
          >
            ✕
          </button>
        </div>

        <div
          className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-1"
          role="tablist"
          aria-label="Shot types"
        >
          {SHOT_TYPES.map((type) => {
            const count = stats.byType[type].scored + stats.byType[type].foul
            const selected = tab === type
            return (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(type)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  selected
                    ? 'bg-white/20 text-white shadow-sm'
                    : count > 0
                      ? 'text-white/75 hover:bg-white/10'
                      : 'text-white/40 hover:bg-white/5'
                }`}
              >
                {TAB_SHORT[type]}
                {count > 0 ? (
                  <span className="ml-1 tabular-nums text-[10px] opacity-75">({count})</span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div role="tabpanel" aria-label={shotTypeLabel(tab)}>
          <ShotTypePanel type={tab} scored={row.scored} foul={row.foul} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-white/50">
          <span className="tabular-nums">{stats.successRate}% overall</span>
          <span>·</span>
          <span className="tabular-nums">{judged} judged</span>
          {tabTotal > 0 ? (
            <>
              <span>·</span>
              <span>
                {typeSuccess(row.scored, row.foul)}% on {shotTypeLabel(tab).toLowerCase()}
              </span>
            </>
          ) : null}
        </div>

        {stats.unregistered > 0 ? (
          <p className="mt-2 text-center text-[11px] text-white/45">
            {stats.unregistered} gesture{stats.unregistered === 1 ? '' : 's'} not classified
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
