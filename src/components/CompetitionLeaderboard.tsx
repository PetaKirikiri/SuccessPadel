import { useState } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { compactLeaderboardDisplayNames, isClaimableGuest } from '../lib/leaderboardEntries'
import { LinePlayerLinkModal } from './LinePlayerLinkModal'

export type LeaderboardEntry = {
  profile_id: string
  padel_player_id?: string | null
  member_profile_id?: string | null
  is_guest?: boolean
  display_name: string
  avatar_url?: string | null
  total_points: number
  games: number
}

type Props = {
  entries: LeaderboardEntry[]
  compact?: boolean
  scoreUnit?: AmericanoScoringUnit
  headerTitle?: string | null
  headerSubtitle?: string | null
  showLeaderFooter?: boolean
  currentUserId?: string | null
  competitionId?: string | null
}

function playerInitial(name: string): string {
  const t = name.trim()
  return t ? t[0]!.toUpperCase() : '?'
}

function rowGrid(showActionColumn: boolean): string {
  return `grid ${
    showActionColumn
      ? 'grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_2.5rem_4rem]'
      : 'grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_2.5rem]'
  } items-center gap-x-2 px-1.5`
}

function LeaderboardRow({
  rank,
  entry,
  isMe,
  showGuestAction,
  showActionColumn,
  onGuestAction,
}: {
  rank: number
  entry: LeaderboardEntry
  isMe: boolean
  showGuestAction: boolean
  showActionColumn: boolean
  onGuestAction?: () => void
}) {
  return (
    <li
      className={`${rowGrid(showActionColumn)} border-b border-brand-border/60 py-2.5 last:border-0 ${
        isMe ? 'bg-brand-bg-alt' : ''
      }`}
    >
      <span
        className={`text-center font-display text-sm font-semibold ${
          rank <= 3 ? 'text-brand-accent' : 'text-brand-muted'
        }`}
      >
        {rank}
      </span>
      {entry.avatar_url ? (
        <img
          src={entry.avatar_url}
          alt=""
          className="h-7 w-7 rounded-full object-cover ring-1 ring-brand-border/60"
        />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-bg-alt text-xs font-semibold text-brand-muted ring-1 ring-brand-border/40">
          {playerInitial(entry.display_name)}
        </div>
      )}
      <span className="truncate text-sm font-medium text-brand-text">{entry.display_name}</span>
      <span className="pl-1 text-right text-sm font-semibold tabular-nums text-brand-accent">
        {entry.total_points}
      </span>
      {showActionColumn ? <div className="flex justify-end">
        {showGuestAction && onGuestAction ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onGuestAction()
            }}
            className="shrink-0 rounded-lg bg-[#06C755] px-2.5 py-1.5 text-xs font-semibold leading-tight text-white"
          >
            Add Line
          </button>
        ) : null}
      </div> : null}
    </li>
  )
}

export function CompetitionLeaderboard({
  entries,
  compact = false,
  scoreUnit = 'points',
  headerTitle = null,
  headerSubtitle = null,
  showLeaderFooter = true,
  currentUserId = null,
  competitionId = null,
}: Props) {
  const [linkTarget, setLinkTarget] = useState<{ id: string; name: string } | null>(null)
  const unit = scoreUnit === 'sets' ? 'sets' : 'pts'
  if (entries.length === 0) return null

  const displayEntries = compactLeaderboardDisplayNames(entries)
  const winner = displayEntries[0]
  const showActionColumn = displayEntries.some((entry) => isClaimableGuest(entry) && !currentUserId)

  const showHeader = Boolean(headerTitle || headerSubtitle || compact)

  return (
    <div className="game-card overflow-hidden p-0">
      {showHeader && (
        <div className="border-b border-brand-border bg-brand-bg-alt px-3 py-2">
          {headerTitle ? (
            <p className="font-display text-base font-semibold text-brand-primary">{headerTitle}</p>
          ) : compact ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              Standings
            </p>
          ) : null}
          {headerSubtitle && <p className="text-xs text-brand-muted">{headerSubtitle}</p>}
        </div>
      )}
      <div
        className={`${rowGrid(showActionColumn)} border-b border-brand-border/60 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-muted`}
      >
        <span className="text-center">#</span>
        <span aria-hidden />
        <span>Player</span>
        <span className="pl-1 text-right">{unit}</span>
        {showActionColumn ? <span aria-hidden /> : null}
      </div>
      <ol className="m-0 list-none p-0">
        {displayEntries.map((e, i) => {
          const source = entries[i]!
          const isMe = Boolean(
            currentUserId &&
              (e.member_profile_id === currentUserId || e.profile_id === currentUserId),
          )
          const showGuestAction = isClaimableGuest(e) && !currentUserId

          return (
            <LeaderboardRow
              key={e.profile_id}
              rank={i + 1}
              entry={e}
              isMe={isMe}
              showGuestAction={showGuestAction}
              showActionColumn={showActionColumn}
              onGuestAction={
                showGuestAction
                  ? () => {
                      setLinkTarget({ id: e.padel_player_id!, name: source.display_name })
                    }
                  : undefined
              }
            />
          )
        })}
      </ol>
      {!compact && showLeaderFooter && winner && (
        <p className="border-t border-brand-border/60 px-3 py-2 text-center text-xs text-brand-muted">
          Leader: {winner.display_name} ({winner.total_points} {unit})
        </p>
      )}
      {linkTarget && (
        <LinePlayerLinkModal
          competitionId={competitionId}
          padelPlayerId={linkTarget.id}
          playerName={linkTarget.name}
          onClose={() => setLinkTarget(null)}
        />
      )}
    </div>
  )
}
