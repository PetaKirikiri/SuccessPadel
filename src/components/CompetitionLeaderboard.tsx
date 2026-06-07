import { useState } from 'react'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import { isClaimableGuest } from '../lib/leaderboardEntries'
import { GuestLineSignInButton } from './GuestLineSignInButton'
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
  onGuestClaim?: (padelPlayerId: string) => void
}

function playerInitial(name: string): string {
  const t = name.trim()
  return t ? t[0]!.toUpperCase() : '?'
}

const ROW_GRID =
  'grid grid-cols-[1.75rem_2rem_minmax(0,1fr)_2.25rem_3rem] items-center gap-x-2 px-3'

function LeaderboardRow({
  rank,
  entry,
  isMe,
  showGuestAction,
  signedIn,
  onGuestAction,
}: {
  rank: number
  entry: LeaderboardEntry
  isMe: boolean
  showGuestAction: boolean
  signedIn: boolean
  onGuestAction?: () => void
}) {
  return (
    <li
      className={`${ROW_GRID} border-b border-brand-border/60 py-2.5 last:border-0 ${
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
          className="h-8 w-8 rounded-full object-cover ring-1 ring-brand-border/60"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-bg-alt text-xs font-semibold text-brand-muted ring-1 ring-brand-border/40">
          {playerInitial(entry.display_name)}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        <span className="truncate text-sm font-medium text-brand-text">{entry.display_name}</span>
        {showGuestAction && onGuestAction && (
          <GuestLineSignInButton signedIn={signedIn} onClick={onGuestAction} compact />
        )}
      </div>
      <span className="text-center text-xs tabular-nums text-brand-muted">{entry.games}</span>
      <span className="text-right text-sm font-semibold tabular-nums text-brand-accent">
        {entry.total_points}
      </span>
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
  onGuestClaim,
}: Props) {
  const [linkTarget, setLinkTarget] = useState<{ id: string; name: string } | null>(null)
  const unit = scoreUnit === 'sets' ? 'sets' : 'pts'
  if (entries.length === 0) return null

  const winner = entries[0]

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
        className={`${ROW_GRID} border-b border-brand-border/60 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-muted`}
      >
        <span className="text-center">#</span>
        <span aria-hidden />
        <span>Player</span>
        <span className="text-center">G</span>
        <span className="text-right">{unit}</span>
      </div>
      <ol className="m-0 list-none p-0">
        {entries.map((e, i) => {
          const isMe = Boolean(
            currentUserId &&
              (e.member_profile_id === currentUserId || e.profile_id === currentUserId),
          )
          const showGuestAction = isClaimableGuest(e)

          return (
            <LeaderboardRow
              key={e.profile_id}
              rank={i + 1}
              entry={e}
              isMe={isMe}
              showGuestAction={showGuestAction}
              signedIn={Boolean(currentUserId)}
              onGuestAction={
                showGuestAction
                  ? () => {
                      if (currentUserId) {
                        onGuestClaim?.(e.padel_player_id!)
                      } else {
                        setLinkTarget({ id: e.padel_player_id!, name: e.display_name })
                      }
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
