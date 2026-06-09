import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FriendlyRosterChips } from './FriendlyRosterChips'
import { useTranslation } from '../hooks/useTranslation'
import type { FriendlyGameRecord } from '../lib/friendlyGames'
import {
  friendlyEndTimeLabel,
  friendlyRosterSlots,
  friendlyRuleChips,
  friendlyWhenLabel,
} from '../lib/friendlyGameDisplay'

type Props = {
  game: FriendlyGameRecord
  to?: string
  currentUserId?: string | null
  showJoinHint?: boolean
  footer?: ReactNode
  className?: string
}

function Badge({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        accent
          ? 'bg-brand-accent/15 text-brand-accent'
          : 'border border-brand-border/70 text-brand-muted'
      }`}
    >
      {children}
    </span>
  )
}

export function FriendlyGameCard({
  game,
  to,
  currentUserId,
  footer,
  className = '',
}: Props) {
  const { t } = useTranslation()
  const isFree = game.playMode === 'free'
  const slots = friendlyRosterSlots(game)
  const when = friendlyWhenLabel(game)
  const endTime = friendlyEndTimeLabel(game)
  const ruleChips = friendlyRuleChips(game)

  const body = (
    <article className={`game-card space-y-3 p-3 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 flex-1 font-display text-sm font-semibold leading-snug text-brand-primary md:text-base">
          {game.title}
        </h2>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <Badge>{game.visibility === 'public' ? t('friendly.public') : t('friendly.private')}</Badge>
          <Badge accent>{isFree ? t('friendly.freePlay') : t('friendly.organizedPlay')}</Badge>
        </div>
      </div>

      <p className="text-sm font-medium text-brand-text">
        {when}
        {endTime ? `–${endTime}` : ''}
      </p>

      {!isFree && ruleChips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {ruleChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center rounded-lg border border-brand-border/70 bg-brand-bg-alt/40 px-2 py-1 text-[11px] font-medium text-brand-text"
            >
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}

      <FriendlyRosterChips slots={slots} currentUserId={currentUserId} />

      {footer}
    </article>
  )

  if (to) {
    return (
      <Link to={to} className="block transition active:opacity-80">
        {body}
      </Link>
    )
  }

  return body
}
