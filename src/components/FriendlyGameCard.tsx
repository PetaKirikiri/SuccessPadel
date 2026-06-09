import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FieldHint } from './FieldHint'
import { FriendlyRosterChips } from './FriendlyRosterChips'
import { useTranslation } from '../hooks/useTranslation'
import type { FriendlyGameRecord } from '../lib/friendlyGames'
import {
  friendlyDurationEstimate,
  friendlyOpenSpots,
  friendlyRosterSlots,
  friendlyRuleChips,
  friendlyRulesSummary,
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

function SectionLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
      <span>{label}</span>
      <FieldHint text={hint} label={label} />
    </p>
  )
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
  showJoinHint = false,
  footer,
  className = '',
}: Props) {
  const { t } = useTranslation()
  const isFree = game.playMode === 'free'
  const slots = friendlyRosterSlots(game)
  const open = friendlyOpenSpots(game)
  const when = friendlyWhenLabel(game)
  const duration = friendlyDurationEstimate(game)
  const rulesLine = friendlyRulesSummary(game)
  const ruleChips = friendlyRuleChips(game)

  const body = (
    <article className={`game-card space-y-3 p-3 ${className}`}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 flex-1 font-display text-sm font-semibold leading-snug text-brand-primary md:text-base">
            {game.title}
          </h2>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Badge>{game.visibility === 'public' ? t('friendly.public') : t('friendly.private')}</Badge>
            <Badge accent>{isFree ? t('friendly.freePlay') : t('friendly.organizedPlay')}</Badge>
          </div>
        </div>
        {rulesLine ? (
          <p className="text-[11px] leading-snug text-brand-muted">{rulesLine}</p>
        ) : null}
      </div>

      <div>
        <SectionLabel
          label={isFree ? t('friendly.card.posted') : t('friendly.card.when')}
          hint={isFree ? t('friendly.hint.posted') : t('friendly.hint.when')}
        />
        <p className="text-sm font-medium text-brand-text">{when}</p>
        {duration ? <p className="mt-0.5 text-[11px] text-brand-muted">{duration}</p> : null}
      </div>

      {!isFree && ruleChips.length > 0 ? (
        <div>
          <SectionLabel label={t('friendly.card.settings')} hint={t('friendly.hint.settings')} />
          <div className="flex flex-wrap gap-1.5">
            {ruleChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-border/70 bg-brand-bg-alt/40 px-2 py-1 text-[11px] font-medium text-brand-text"
              >
                {chip.label}
                <FieldHint text={t(chip.hintKey)} label={chip.label} />
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <SectionLabel label={t('friendly.card.players')} hint={t('friendly.hint.players')} />
        <FriendlyRosterChips slots={slots} currentUserId={currentUserId} />
        {open > 0 ? (
          <p className="mt-1.5 text-[11px] text-brand-muted">
            {open} {open === 1 ? t('friendly.card.spotOpen') : t('friendly.card.spotsOpen')}
          </p>
        ) : null}
      </div>

      {showJoinHint && open > 0 && currentUserId ? (
        <p className="text-[11px] font-semibold text-brand-accent">{t('friendly.tapToJoin')}</p>
      ) : null}

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
