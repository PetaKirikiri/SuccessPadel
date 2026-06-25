import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PlayerAvatar } from './PlayerAvatar'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'
import {
  ACHIEVEMENT_IMAGE,
  podiumAchievementForPoints,
  podiumPointTiers,
  sortAchievementsForDisplay,
  standingsDisplayRank,
} from '../lib/competitionAchievements'
import type {
  Achievement,
  CompetitionAchievements,
} from '../lib/competitionAchievements'
import type { AmericanoScoringUnit } from '../lib/competitionPresets'
import {
  compactLeaderboardDisplayNames,
  leaderboardEntryLookupIds,
} from '../lib/leaderboardEntries'
import { isDuoLeaderboardEntry } from '../lib/leaderboardFilters'
import { openPlayerProfile } from '../lib/openPlayerProfile'
import { LeaderboardShareButton, type LeaderboardShareRow } from './LeaderboardShareButton'

export type LeaderboardEntry = {
  profile_id: string
  padel_player_id?: string | null
  member_profile_id?: string | null
  player_a_id?: string | null
  player_b_id?: string | null
  player_a_name?: string | null
  player_b_name?: string | null
  player_a_avatar_url?: string | null
  player_b_avatar_url?: string | null
  is_guest?: boolean
  display_name: string
  avatar_url?: string | null
  total_points: number
  games: number
  wins?: number
  losses?: number
  draws?: number
}

type Props = {
  entries: LeaderboardEntry[]
  compact?: boolean
  scoreUnit?: AmericanoScoringUnit
  scoreColumnLabel?: string
  headerTitle?: string | null
  headerSubtitle?: string | null
  headerExtra?: React.ReactNode
  currentUserId?: string | null
  competitionId?: string | null
  achievements?: CompetitionAchievements | null
  showAchievements?: boolean
  flushBottom?: boolean
  embedded?: boolean
  shareTitle?: string | null
  simpleTeamRows?: boolean
}

type AchievementInfo = { iconKey: string; emoji: string; labelKey: string }

function AchievementBadge({
  iconKey,
  emoji,
  labelKey,
  label,
  onSelect,
  sizeClass,
  emojiClass,
}: {
  iconKey: string
  emoji: string
  labelKey: string
  label: string
  onSelect?: (info: AchievementInfo) => void
  sizeClass: string
  emojiClass: string
}) {
  const image = ACHIEVEMENT_IMAGE[iconKey]
  const content = image ? (
    <img src={image} alt="" className="h-full w-full object-contain" />
  ) : (
    <span aria-hidden className={emojiClass}>
      {emoji}
    </span>
  )
  if (!onSelect) {
    return (
      <span
        aria-label={label}
        title={label}
        className={`flex shrink-0 items-center justify-center ${sizeClass}`}
      >
        {content}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect({ iconKey, emoji, labelKey })
      }}
      aria-label={label}
      title={label}
      className={`flex shrink-0 items-center justify-center ${sizeClass}`}
    >
      {content}
    </button>
  )
}


function entryRecord(
  entry: LeaderboardEntry,
): { wins: number; losses: number; draws: number } | null {
  if (entry.wins == null && entry.losses == null && entry.draws == null) {
    if (entry.games <= 0) return { wins: 0, losses: 0, draws: 0 }
    return null
  }
  const wins = entry.wins ?? 0
  const losses = entry.losses ?? 0
  const draws = entry.draws ?? Math.max(0, entry.games - wins - losses)
  return { wins, losses, draws }
}

function ScoreWithRecord({
  score,
  record,
  compact = false,
  t,
}: {
  score: number
  record: { wins: number; losses: number; draws: number } | null
  compact?: boolean
  t: TranslateFn
}) {
  return (
    <div className="relative z-[1] flex shrink-0 flex-col items-end justify-self-end text-right">
      <span
        className={`font-display font-bold tabular-nums text-brand-accent ${
          compact ? 'text-base' : 'text-lg md:text-xl'
        }`}
      >
        {score}
      </span>
      {record ? (
        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium tabular-nums text-brand-muted md:text-[11px]">
          <span title={t('leaderboard.wins')}>
            {record.wins}
            {t('leaderboard.winsShort')}
          </span>
          <span title={t('leaderboard.losses')}>
            {record.losses}
            {t('leaderboard.lossesShort')}
          </span>
          <span title={t('leaderboard.draws')}>
            {record.draws}
            {t('leaderboard.drawsShort')}
          </span>
        </p>
      ) : null}
    </div>
  )
}

const ROW_GRID =
  'grid items-center gap-x-1 px-1.5 md:gap-x-1.5 md:px-2 grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_minmax(0,4.5rem)_3.25rem] md:grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_minmax(0,7rem)_3.75rem]'

const ROW_GRID_NO_BADGES =
  'grid items-center gap-x-1 px-1.5 md:gap-x-1.5 md:px-2 grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_3.25rem] md:grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_3.75rem]'

const COMPACT_ROW_GRID =
  'grid h-full w-full items-center gap-x-2 px-2 grid-cols-[1.25rem_2rem_minmax(0,1fr)_2.75rem]'

const COMPACT_ROW_GRID_BADGES =
  'grid h-full w-full items-center gap-x-2 px-2 grid-cols-[1.25rem_2rem_minmax(0,1fr)_minmax(0,4rem)_2.75rem]'

const COMPACT_TEAM_ROW_GRID =
  'grid h-full w-full items-center gap-x-2 px-2 grid-cols-[1.25rem_minmax(0,1fr)_2.75rem]'

function TeamPlayersInline({ entry }: { entry: LeaderboardEntry }) {
  const players = [
    { name: entry.player_a_name, avatarUrl: entry.player_a_avatar_url },
    { name: entry.player_b_name, avatarUrl: entry.player_b_avatar_url },
  ].filter((player): player is { name: string; avatarUrl: string | null | undefined } =>
    Boolean(player.name?.trim()),
  )

  if (players.length === 0) return null

  return (
    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      {players.map((player) => (
        <span key={player.name} className="flex min-w-0 items-center gap-1">
          <PlayerAvatar
            displayName={player.name}
            avatarUrl={player.avatarUrl}
            imgClassName="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-brand-border/60"
            pixelated={player.avatarUrl?.includes('/pixel.png') ?? false}
          />
          <span className="max-w-[7rem] truncate text-[10px] font-medium leading-none text-brand-muted">
            {player.name}
          </span>
        </span>
      ))}
    </span>
  )
}

function LeaderboardRow({
  rank,
  entry,
  isMe,
  badges,
  showBadges,
  compact = false,
  simpleTeamRow = false,
  onOpenProfile,
  onSelectAchievement,
  t,
}: {
  rank: number
  entry: LeaderboardEntry
  isMe: boolean
  badges: Achievement[]
  showBadges: boolean
  compact?: boolean
  simpleTeamRow?: boolean
  onOpenProfile?: () => void | Promise<void>
  onSelectAchievement: (info: AchievementInfo) => void
  t: TranslateFn
}) {
  const record = entryRecord(entry)

  return (
    <li
      onClick={() => {
        if (onOpenProfile) void onOpenProfile()
      }}
      className={`${
        compact && simpleTeamRow
          ? COMPACT_TEAM_ROW_GRID
          : compact
          ? showBadges
            ? COMPACT_ROW_GRID_BADGES
            : COMPACT_ROW_GRID
          : showBadges
            ? ROW_GRID
            : ROW_GRID_NO_BADGES
      } min-h-0 border-b border-brand-border/60 transition last:border-0 ${
        compact ? 'flex-1' : 'py-2.5 md:py-3.5'
      } ${onOpenProfile ? 'cursor-pointer hover:bg-brand-bg-alt/60' : ''} ${isMe ? 'bg-brand-bg-alt' : ''}`}
    >
      <span
        className={`text-center font-display text-sm font-semibold ${
          rank <= 3 ? 'text-brand-accent' : 'text-brand-muted'
        }`}
      >
        {rank}
      </span>
      {!simpleTeamRow ? (
        <PlayerAvatar
          displayName={entry.display_name}
          avatarUrl={entry.avatar_url}
          imgClassName={`rounded-full object-cover ring-1 ring-brand-border/60 ${
            compact ? 'h-8 w-8' : 'h-7 w-7 md:h-10 md:w-10'
          }`}
          pixelated={entry.avatar_url?.includes('/pixel.png') ?? false}
        />
      ) : null}
      {simpleTeamRow ? (
        <span className="min-w-0">
          <span className="block whitespace-normal break-words text-sm font-semibold leading-tight text-brand-text md:text-base">
            {entry.display_name}
          </span>
          <TeamPlayersInline entry={entry} />
        </span>
      ) : (
        <span className="min-w-0 truncate text-sm font-medium text-brand-text md:text-base">
          {entry.display_name}
        </span>
      )}
      {showBadges ? (
        <span className="flex max-w-full items-center justify-center justify-self-center gap-0.5 overflow-hidden md:gap-1">
          {badges.slice(0, 3).map((b) => (
            <AchievementBadge
              key={b.key}
              iconKey={b.key}
              emoji={b.icon}
              labelKey={b.labelKey}
              label={t(b.labelKey)}
              onSelect={onSelectAchievement}
              sizeClass={compact ? 'h-7 w-7' : 'h-6 w-6 md:h-9 md:w-9'}
              emojiClass={compact ? 'text-base leading-none' : 'text-lg leading-none md:text-2xl'}
            />
          ))}
        </span>
      ) : null}
      <ScoreWithRecord score={entry.total_points} record={compact ? null : record} compact={compact} t={t} />
    </li>
  )
}

export function CompetitionLeaderboard({
  entries,
  compact = false,
  scoreUnit = 'points',
  scoreColumnLabel,
  headerTitle = null,
  headerSubtitle = null,
  headerExtra = null,
  currentUserId = null,
  competitionId = null,
  achievements = null,
  showAchievements = false,
  flushBottom = false,
  embedded = false,
  shareTitle = null,
  simpleTeamRows = false,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [info, setInfo] = useState<AchievementInfo | null>(null)
  const activeEntries = entries
  const showingTeamEntries = activeEntries.some((entry) =>
    isDuoLeaderboardEntry(entry.profile_id),
  )
  const unit =
    scoreColumnLabel ??
    (scoreUnit === 'sets'
      ? t('leaderboard.sets')
      : scoreUnit === 'games'
        ? t('leaderboard.games')
        : t('leaderboard.pts'))
  if (activeEntries.length === 0) return null

  const hasAnyScores = activeEntries.some((entry) => entry.games > 0)
  const podiumTiers = useMemo(() => podiumPointTiers(activeEntries), [activeEntries])

  const effectiveShowAchievements = showAchievements && !simpleTeamRows

  const badgesFor = (entry: LeaderboardEntry): Achievement[] => {
    if (!effectiveShowAchievements || !achievements) return []
    const map = achievements.individualAchievementsByPlayerId
    for (const id of leaderboardEntryLookupIds(entry)) {
      if (map[id]) return sortAchievementsForDisplay(map[id]!)
    }
    if (!hasAnyScores || entry.games <= 0) return []
    const podium = podiumAchievementForPoints(entry, podiumTiers)
    return podium ? [podium] : []
  }

  const displayEntries = compactLeaderboardDisplayNames(activeEntries)
  const showHeader = Boolean(headerTitle || headerSubtitle || headerExtra)
  const rowGrid = effectiveShowAchievements ? ROW_GRID : ROW_GRID_NO_BADGES
  const nameColumnLabel = showingTeamEntries ? t('leaderboard.teams') : t('leaderboard.player')

  const shareRows = useMemo((): LeaderboardShareRow[] => {
    if (!shareTitle) return []
    return displayEntries.slice(0, 15).map((entry, i) => {
      const source = activeEntries[i]!
      const badges = badgesFor(source)
      return {
        rank: standingsDisplayRank(activeEntries, i),
        name: entry.display_name,
        points: entry.total_points,
        avatarUrl: entry.avatar_url,
        badges: badges.map((badge) => ({
          iconKey: badge.key,
          emoji: badge.icon,
        })),
      }
    })
  }, [shareTitle, displayEntries, activeEntries, badgesFor])

  const shellClass = embedded
    ? compact
      ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-brand-surface'
      : 'min-h-full overflow-hidden bg-brand-surface'
    : `game-card overflow-hidden p-0 ${flushBottom ? 'rounded-b-none' : ''}`

  return (
    <div className={shellClass}>
      {shareTitle && shareRows.length > 0 ? (
        <div
          className={`flex items-center justify-end border-b border-brand-border/60 ${
            compact ? 'px-2 py-2' : 'px-3 py-2 md:px-4'
          }`}
        >
          <LeaderboardShareButton
            title={shareTitle}
            rows={shareRows}
            scoreUnit={unit}
            playerColumnLabel={nameColumnLabel}
            t={t}
            compact={compact}
          />
        </div>
      ) : null}
      {headerExtra}
      {showHeader && (
        <div
          className={`border-b border-brand-border px-3 py-2 md:px-4 md:py-3 ${embedded ? 'bg-brand-surface' : 'bg-brand-bg-alt'}`}
        >
          {headerTitle ? (
            <p className="font-display text-base font-semibold text-brand-primary md:text-lg">
              {headerTitle}
            </p>
          ) : null}
          {headerSubtitle && <p className="text-xs text-brand-muted md:text-sm">{headerSubtitle}</p>}
        </div>
      )}
      {!compact ? (
        <div
          className={`${rowGrid} border-b border-brand-border/60 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-muted md:py-2.5 md:text-xs`}
        >
          <span className="text-center">#</span>
          <span aria-hidden />
          <span>{nameColumnLabel}</span>
          {effectiveShowAchievements ? <span aria-hidden /> : null}
          <span className="justify-self-end text-right font-display text-xs uppercase text-brand-muted md:text-sm">
            {unit}
          </span>
        </div>
      ) : null}
      <ol className={compact ? 'm-0 flex min-h-0 flex-1 list-none flex-col p-0' : 'm-0 list-none p-0'}>
        {displayEntries.map((e, i) => {
          const source = activeEntries[i]!
          const rank = standingsDisplayRank(activeEntries, i)
          const isMe = Boolean(
            currentUserId &&
              (e.member_profile_id === currentUserId ||
                e.profile_id === currentUserId ||
                e.player_a_id === currentUserId ||
                e.player_b_id === currentUserId),
          )

          return (
            <LeaderboardRow
              key={e.profile_id}
              rank={rank}
              entry={e}
              isMe={isMe}
              badges={badgesFor(source)}
              showBadges={effectiveShowAchievements}
              compact={compact}
              simpleTeamRow={simpleTeamRows && isDuoLeaderboardEntry(source.profile_id)}
              onSelectAchievement={setInfo}
              onOpenProfile={
                isDuoLeaderboardEntry(source.profile_id)
                  ? undefined
                  : () => {
                      void openPlayerProfile(navigate, {
                        profileId: source.member_profile_id ?? null,
                        padelPlayerId: source.padel_player_id ?? null,
                        displayName: source.display_name,
                        competitionId,
                        from: location.pathname + location.search,
                        snapshot: {
                          entry: source,
                          rank,
                          unit,
                          badges: badgesFor(source),
                        },
                      })
                    }
              }
              t={t}
            />
          )
        })}
      </ol>
      {info && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setInfo(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-brand-border bg-brand-surface p-5 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center">
              {ACHIEVEMENT_IMAGE[info.iconKey] ? (
                <img
                  src={ACHIEVEMENT_IMAGE[info.iconKey]}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-5xl leading-none" aria-hidden>
                  {info.emoji}
                </span>
              )}
            </div>
            <p className="font-display text-lg font-bold text-brand-primary">
              {t(info.labelKey)}
            </p>
            <p className="mt-1 text-sm text-brand-muted">{t(`${info.labelKey}Desc`)}</p>
            <button
              type="button"
              onClick={() => setInfo(null)}
              className="brand-btn mt-4 w-full"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
