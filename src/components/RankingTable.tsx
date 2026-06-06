import type { DuosLeaderboardRow, LeaderboardRow, RankMode } from '../lib/types'
import { TierBadge } from './TierBadge'

type Props = {
  mode: RankMode
  onModeChange: (mode: RankMode) => void
  seasonName?: string | null
  soloRows: LeaderboardRow[]
  duosRows: DuosLeaderboardRow[]
  currentUserId?: string | null
}

type DisplayRow = {
  key: string
  rank: number
  display_name: string
  level: string
  wins: number
  losses: number
  matches_played: number
  points_this_week: number
  season_points: number
  isMe: boolean
}

function RankTab({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-brand-accent text-white shadow-sm'
          : 'text-brand-muted hover:text-brand-text'
      }`}
    >
      {children}
    </button>
  )
}

function toSoloRows(rows: LeaderboardRow[], currentUserId?: string | null): DisplayRow[] {
  return rows.map((row) => ({
    key: row.profile_id,
    rank: row.rank,
    display_name: row.display_name,
    level: row.level,
    wins: row.wins,
    losses: row.losses,
    matches_played: row.matches_played,
    points_this_week: row.points_this_week,
    season_points: row.season_points,
    isMe: row.profile_id === currentUserId,
  }))
}

function toDuosRows(rows: DuosLeaderboardRow[], currentUserId?: string | null): DisplayRow[] {
  return rows.map((row) => ({
    key: `${row.player_a_id}-${row.player_b_id}`,
    rank: row.rank,
    display_name: row.display_name,
    level: row.level,
    wins: row.wins,
    losses: row.losses,
    matches_played: row.matches_played,
    points_this_week: row.points_this_week,
    season_points: row.season_points,
    isMe: row.player_a_id === currentUserId || row.player_b_id === currentUserId,
  }))
}

function RankRow({ row }: { row: DisplayRow }) {
  return (
    <li
      className={`flex items-center gap-2 border-b border-brand-border/60 px-2 py-3 last:border-0 ${
        row.isMe ? 'bg-brand-bg-alt' : ''
      }`}
    >
      <span
        className={`w-8 shrink-0 text-center font-display text-lg font-semibold ${
          row.rank <= 3 ? 'text-brand-accent' : 'text-brand-muted'
        }`}
      >
        {row.rank}
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate font-medium text-brand-text">{row.display_name}</p>
        <div className="mt-0.5">
          <TierBadge level={row.level} />
        </div>
        <p className="truncate text-xs text-brand-muted">
          {row.wins}W · {row.losses}L · {row.matches_played} matches
          {row.points_this_week > 0 && ` · +${row.points_this_week} this week`}
        </p>
      </div>
      <span className="w-10 shrink-0 text-right text-lg font-semibold tabular-nums text-brand-accent">
        {row.season_points}
      </span>
    </li>
  )
}

export function RankingTable({
  mode,
  onModeChange,
  seasonName,
  soloRows,
  duosRows,
  currentUserId,
}: Props) {
  const rows =
    mode === 'solo'
      ? toSoloRows(soloRows, currentUserId)
      : toDuosRows(duosRows, currentUserId)
  const emptyLabel = mode === 'solo' ? 'No solo standings yet.' : 'No duos standings yet.'

  return (
    <div className="game-card overflow-hidden p-0">
      <div className="border-b border-brand-border bg-brand-bg-alt px-3 py-2">
        <div className="flex gap-1">
          <RankTab active={mode === 'solo'} onClick={() => onModeChange('solo')}>
            Solo
          </RankTab>
          <RankTab active={mode === 'duos'} onClick={() => onModeChange('duos')}>
            Duos
          </RankTab>
        </div>
        {seasonName && (
          <p className="mt-1.5 truncate text-xs font-medium text-brand-muted">{seasonName}</p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="game-subtle px-3 py-8 text-center">{emptyLabel}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((row) => (
            <RankRow key={row.key} row={row} />
          ))}
        </ul>
      )}
    </div>
  )
}
