import { useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
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
  const base = 'grid items-center gap-x-2 px-1.5 md:gap-x-3 md:px-2'
  // Name + Add Line stay left; 1fr spacer pushes points to the right edge
  if (showActionColumn) {
    return `${base} grid-cols-[1.25rem_1.75rem_minmax(0,10rem)_5rem_1fr_auto] md:grid-cols-[1.5rem_2.5rem_minmax(0,12rem)_5.5rem_1fr_auto]`
  }
  return `${base} grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_auto] md:grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_auto]`
}

function LeaderboardRow({
  rank,
  entry,
  isMe,
  showGuestAction,
  showActionColumn,
  onGuestAction,
  addLineLabel,
}: {
  rank: number
  entry: LeaderboardEntry
  isMe: boolean
  showGuestAction: boolean
  showActionColumn: boolean
  onGuestAction?: () => void
  addLineLabel: string
}) {
  return (
    <li
      className={`${rowGrid(showActionColumn)} border-b border-brand-border/60 py-2.5 last:border-0 md:py-3.5 ${
        isMe ? 'bg-brand-bg-alt' : ''
      }`}
    >
      <span
        className={`text-center font-display text-sm font-semibold md:text-base ${
          rank <= 3 ? 'text-brand-accent' : 'text-brand-muted'
        }`}
      >
        {rank}
      </span>
      {entry.avatar_url ? (
        <img
          src={entry.avatar_url}
          alt=""
          className="h-7 w-7 rounded-full object-cover ring-1 ring-brand-border/60 md:h-10 md:w-10"
        />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-bg-alt text-xs font-semibold text-brand-muted ring-1 ring-brand-border/40 md:h-10 md:w-10 md:text-sm">
          {playerInitial(entry.display_name)}
        </div>
      )}
      <span className="min-w-0 truncate text-sm font-medium text-brand-text md:text-base">
        {entry.display_name}
      </span>
      {showActionColumn ? (
        <>
          <div className="flex items-center justify-start">
            {showGuestAction && onGuestAction ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onGuestAction()
                }}
                className="w-full rounded-lg bg-[#06C755] px-2 py-1 text-center text-[10px] font-semibold leading-tight text-white md:px-2.5 md:py-1.5 md:text-xs"
              >
                {addLineLabel}
              </button>
            ) : null}
          </div>
          <span aria-hidden className="min-w-0" />
        </>
      ) : null}
      <span className="justify-self-end text-right font-display text-lg font-bold tabular-nums text-brand-accent md:text-xl">
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
}: Props) {
  const { t } = useTranslation()
  const [linkTarget, setLinkTarget] = useState<{ id: string; name: string } | null>(null)
  const unit = scoreUnit === 'sets' ? t('leaderboard.sets') : t('leaderboard.pts')
  if (entries.length === 0) return null

  const displayEntries = compactLeaderboardDisplayNames(entries)
  const winner = displayEntries[0]
  const showActionColumn =
    !currentUserId && displayEntries.some((entry) => isClaimableGuest(entry))
  const showHeader = Boolean(headerTitle || headerSubtitle || compact)

  return (
    <div className="game-card overflow-hidden p-0">
      {showHeader && (
        <div className="border-b border-brand-border bg-brand-bg-alt px-3 py-2 md:px-4 md:py-3">
          {headerTitle ? (
            <p className="font-display text-base font-semibold text-brand-primary md:text-lg">
              {headerTitle}
            </p>
          ) : compact ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted md:text-xs">
              {t('leaderboard.standings')}
            </p>
          ) : null}
          {headerSubtitle && <p className="text-xs text-brand-muted md:text-sm">{headerSubtitle}</p>}
        </div>
      )}
      <div
        className={`${rowGrid(showActionColumn)} border-b border-brand-border/60 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-muted md:py-2.5 md:text-xs`}
      >
        <span className="text-center">#</span>
        <span aria-hidden />
        <span>{t('leaderboard.player')}</span>
        {showActionColumn ? (
          <>
            <span aria-hidden />
            <span aria-hidden />
          </>
        ) : null}
        <span className="justify-self-end text-right font-display text-xs uppercase text-brand-muted md:text-sm">
          {unit}
        </span>
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
              addLineLabel={t('leaderboard.addLine')}
            />
          )
        })}
      </ol>
      {!compact && showLeaderFooter && winner && (
        <p className="border-t border-brand-border/60 px-3 py-2 text-center text-xs text-brand-muted md:px-4 md:py-3 md:text-sm">
          {t('leaderboard.leaderFooter', {
            name: winner.display_name,
            points: winner.total_points,
            unit,
          })}
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
