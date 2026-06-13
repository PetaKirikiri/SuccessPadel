import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import type { TranslateFn } from '../i18n'
import { ACHIEVEMENT_IMAGE, podiumAchievementForRank, sortAchievementsForDisplay } from '../lib/competitionAchievements'
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

export type LeaderboardEntry = {
  profile_id: string
  padel_player_id?: string | null
  member_profile_id?: string | null
  player_a_id?: string | null
  player_b_id?: string | null
  is_guest?: boolean
  display_name: string
  avatar_url?: string | null
  total_points: number
  games: number
  wins?: number
  losses?: number
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
  flushBottom?: boolean
  embedded?: boolean
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

function playerInitial(name: string): string {
  const t = name.trim()
  return t ? t[0]!.toUpperCase() : '?'
}

function winLossRecord(entry: LeaderboardEntry): string | null {
  if (entry.games <= 0) return null
  const wins = entry.wins ?? 0
  const losses = entry.losses ?? 0
  const ties = Math.max(0, entry.games - wins - losses)
  const record = ties > 0 ? `${wins}W · ${losses}L · ${ties}T` : `${wins}W · ${losses}L`
  return `${entry.games}G · ${record}`
}

const ROW_GRID =
  'grid items-center gap-x-2 px-1.5 md:gap-x-3 md:px-2 grid-cols-[1.25rem_1.75rem_6rem_minmax(0,1fr)_auto] md:grid-cols-[1.5rem_2.5rem_9rem_minmax(0,1fr)_auto]'

function LeaderboardRow({
  rank,
  entry,
  isMe,
  badges,
  onOpenProfile,
  onSelectAchievement,
  t,
}: {
  rank: number
  entry: LeaderboardEntry
  isMe: boolean
  badges: Achievement[]
  onOpenProfile?: () => void | Promise<void>
  onSelectAchievement: (info: AchievementInfo) => void
  t: TranslateFn
}) {
  const record = winLossRecord(entry)

  return (
    <li
      onClick={() => {
        if (onOpenProfile) void onOpenProfile()
      }}
      className={`${ROW_GRID} border-b border-brand-border/60 py-2.5 transition last:border-0 md:py-3.5 ${
        onOpenProfile ? 'cursor-pointer hover:bg-brand-bg-alt/60' : ''
      } ${isMe ? 'bg-brand-bg-alt' : ''}`}
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
      <span className="flex min-w-0 items-center gap-1 md:gap-1.5">
        {badges.slice(0, 3).map((b) => (
          <AchievementBadge
            key={b.key}
            iconKey={b.key}
            emoji={b.icon}
            labelKey={b.labelKey}
            label={t(b.labelKey)}
            onSelect={onSelectAchievement}
            sizeClass="h-7 w-7 md:h-10 md:w-10"
            emojiClass="text-xl leading-none md:text-3xl"
          />
        ))}
      </span>
      <span className="flex flex-col items-end justify-self-end text-right leading-tight">
        <span className="font-display text-lg font-bold tabular-nums text-brand-accent md:text-xl">
          {entry.total_points}
        </span>
        {record ? (
          <span className="text-[10px] font-medium tabular-nums text-brand-muted md:text-xs">
            {record}
          </span>
        ) : null}
      </span>
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
  flushBottom = false,
  embedded = false,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [info, setInfo] = useState<AchievementInfo | null>(null)
  const unit =
    scoreColumnLabel ??
    (scoreUnit === 'sets'
      ? t('leaderboard.sets')
      : scoreUnit === 'games'
        ? t('leaderboard.games')
        : t('leaderboard.pts'))
  if (entries.length === 0) return null

  const hasAnyScores = entries.some((entry) => entry.games > 0)

  const badgesFor = (entry: LeaderboardEntry, rank: number): Achievement[] => {
    if (!achievements) return []
    const map = achievements.individualAchievementsByPlayerId
    for (const id of leaderboardEntryLookupIds(entry)) {
      if (map[id]) return sortAchievementsForDisplay(map[id]!)
    }
    if (!hasAnyScores || entry.games <= 0) return []
    const podium = podiumAchievementForRank(rank)
    return podium ? [podium] : []
  }

  const displayEntries = compactLeaderboardDisplayNames(entries)
  const showHeader = Boolean(headerTitle || headerSubtitle || headerExtra || compact)

  const shellClass = embedded
    ? 'min-h-full overflow-hidden bg-brand-surface'
    : `game-card overflow-hidden p-0 ${flushBottom ? 'rounded-b-none' : ''}`

  return (
    <div className={shellClass}>
      {headerExtra}
      {showHeader && (
        <div
          className={`border-b border-brand-border px-3 py-2 md:px-4 md:py-3 ${embedded ? 'bg-brand-surface' : 'bg-brand-bg-alt'}`}
        >
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
        className={`${ROW_GRID} border-b border-brand-border/60 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-muted md:py-2.5 md:text-xs`}
      >
        <span className="text-center">#</span>
        <span aria-hidden />
        <span>{t('leaderboard.player')}</span>
        <span aria-hidden />
        <span className="justify-self-end text-right font-display text-xs uppercase text-brand-muted md:text-sm">
          {unit}
        </span>
      </div>
      <ol className="m-0 list-none p-0">
        {displayEntries.map((e, i) => {
          const source = entries[i]!
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
              rank={i + 1}
              entry={e}
              isMe={isMe}
              badges={badgesFor(source, i + 1)}
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
                          rank: i + 1,
                          unit,
                          badges: badgesFor(source, i + 1),
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
