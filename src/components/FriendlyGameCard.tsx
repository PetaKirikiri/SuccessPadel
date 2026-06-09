import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CompetitionLayoutPreview } from './CompetitionLayoutPreview'
import { useTranslation } from '../hooks/useTranslation'
import { translateCountdownLabel } from '../i18n/competitionLabels'
import { firstDisplayName } from '../lib/leaderboardEntries'
import { competitionCountdown } from '../lib/competitionListCard'
import type { FriendlyGameRecord } from '../lib/friendlyGames'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
  isFreeFriendly,
  isOrganizedFriendly,
} from '../lib/friendlyGames'
import type { FriendlyRosterSlot } from '../lib/friendlyGameDisplay'
import {
  friendlyEndTimeLabel,
  friendlyListCardTiming,
  friendlyRosterSlots,
  friendlyRulesSummary,
  friendlyWhenLabel,
} from '../lib/friendlyGameDisplay'

type Props = {
  game: FriendlyGameRecord
  to?: string
  currentUserId?: string | null
  currentUserAvatarUrl?: string | null
  isAdmin?: boolean
  courtNames?: string[]
  showCourts?: boolean
  footer?: ReactNode
  className?: string
}

function AvatarStack({
  slots,
  currentUserId,
}: {
  slots: FriendlyRosterSlot[]
  currentUserId?: string | null
}) {
  return (
    <div className="flex items-center">
      {slots.map((slot, i) => {
        if (slot.vacant) {
          return (
            <span
              key={`open-${i}`}
              className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-brand-border/80 bg-brand-bg-alt/60 text-[11px] font-semibold text-brand-muted ring-2 ring-brand-surface first:ml-0"
            >
              +
            </span>
          )
        }
        const name = firstDisplayName(slot.name || 'Player')
        const isMe = Boolean(currentUserId && slot.profileId === currentUserId)
        const ring = isMe ? 'ring-brand-accent' : 'ring-brand-surface'
        return slot.avatarUrl ? (
          <img
            key={`${slot.profileId ?? slot.name}-${i}`}
            src={slot.avatarUrl}
            alt=""
            className={`-ml-2 h-7 w-7 rounded-full object-cover ring-2 first:ml-0 ${ring}`}
          />
        ) : (
          <span
            key={`${slot.profileId ?? slot.name}-${i}`}
            className={`-ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-bg-alt text-[11px] font-semibold text-brand-primary ring-2 first:ml-0 ${ring}`}
          >
            {name[0]?.toUpperCase() ?? '?'}
          </span>
        )
      })}
    </div>
  )
}

export function FriendlyGameCard({
  game,
  to,
  currentUserId,
  currentUserAvatarUrl,
  isAdmin = false,
  courtNames = [],
  showCourts = false,
  footer,
  className = '',
}: Props) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now())
  const isFree = isFreeFriendly(game)
  const slots = friendlyRosterSlots(game)
  const filled = slots.filter((s) => !s.vacant).length
  const when = friendlyWhenLabel(game)
  const endTime = friendlyEndTimeLabel(game)
  const rulesLine = friendlyRulesSummary(game)
  const mode = isFree ? t('friendly.freePlay') : t('friendly.organizedPlay')
  const spots = `${filled}/${slots.length}`
  const meta = [`${when}${endTime ? `–${endTime}` : ''}`, mode, spots].filter(Boolean).join(' · ')
  const timing = friendlyListCardTiming(game)

  useEffect(() => {
    if (!timing) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [timing])

  const countdown = useMemo(
    () => (timing ? competitionCountdown(timing, now) : null),
    [timing, now],
  )

  const organizedConfig = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const previewGames = friendlyPreviewGames(game, courtNames, game.profileAvatars)
  const previewSession = friendlyOrganizedSession(organizedConfig)
  const startsAtIso = friendlyStartsAtIso(organizedConfig)
  const showCourtBoard =
    showCourts && isAdmin && isOrganizedFriendly(game) && previewGames.length > 0 && courtNames.length > 0

  const inner = (
    <div className="px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-snug text-brand-primary">
            {game.title}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-brand-muted">{meta}</p>
          {rulesLine ? (
            <p className="mt-0.5 text-[11px] leading-snug text-brand-muted">{rulesLine}</p>
          ) : null}
          {countdown ? (
            <p className="mt-0.5 text-[11px] tabular-nums text-brand-muted">
              {translateCountdownLabel(t, countdown.label)} {countdown.value}
            </p>
          ) : null}
          <div className="mt-1.5">
            <AvatarStack slots={slots} currentUserId={currentUserId} />
          </div>
        </div>
        {to ? <span className="shrink-0 text-sm text-brand-muted">›</span> : null}
      </div>
    </div>
  )

  return (
    <article className={`game-card overflow-hidden p-0 ${className}`}>
      {to ? (
        <Link to={to} className="block transition-opacity active:opacity-80">
          {inner}
        </Link>
      ) : (
        inner
      )}

      {showCourtBoard ? (
        <div className="border-t border-brand-border/60 px-1 pb-2 pt-2">
          <CompetitionLayoutPreview
            session={previewSession}
            games={previewGames}
            eventStartsAt={startsAtIso}
            gameMinutes={organizedConfig.gameMinutes}
            friendlySessionId={game.id}
            friendly
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            currentUserAvatarUrl={currentUserAvatarUrl}
          />
        </div>
      ) : null}

      {isAdmin && isFree && to ? (
        <div className="border-t border-brand-border/60 px-3 py-2.5">
          <Link
            to={`/friendly/${game.id}/pad`}
            className="brand-btn block w-full py-2 text-center text-sm font-semibold"
          >
            {t('friendly.openPad')}
          </Link>
        </div>
      ) : null}

      {footer}
    </article>
  )
}
