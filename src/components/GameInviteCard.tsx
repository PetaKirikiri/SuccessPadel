import type { ReactNode } from 'react'
import { IconDelete, IconEdit, IconShare } from './ButtonIcons'
import { Link } from 'react-router-dom'
import { FriendlyRosterList } from './FriendlyRosterList'
import { FriendlyRuleSettings } from './FriendlyRuleSettings'
import type { FriendlyRosterSlot, FriendlyRuleChip } from '../lib/friendlyGameDisplay'

export type GameInviteCardProps = {
  title: string
  dateLine: string
  timeLine: string
  detailTo: string
  slots: FriendlyRosterSlot[]
  currentUserId?: string | null
  ruleChips?: FriendlyRuleChip[]
  skillLevel?: string | null
  gender?: string | null
  statusLine?: string | null
  onShare?: () => void
  shareFeedback?: string | null
  shareAriaLabel?: string
  canEdit?: boolean
  editTo?: string
  editAriaLabel?: string
  canDelete?: boolean
  onDelete?: () => void
  deleteBusy?: boolean
  deleteError?: string | null
  deleteAriaLabel?: string
  belowLink?: ReactNode
  footer?: ReactNode
  className?: string
}

const adminCornerBtnClass =
  'flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-bg-alt shadow-sm active:scale-[0.98]'

export function GameInviteCard({
  title,
  dateLine,
  timeLine,
  detailTo,
  slots,
  currentUserId,
  ruleChips = [],
  skillLevel,
  gender,
  statusLine,
  onShare,
  shareFeedback,
  shareAriaLabel,
  canEdit = false,
  editTo,
  editAriaLabel,
  canDelete = false,
  onDelete,
  deleteBusy = false,
  deleteError,
  deleteAriaLabel,
  belowLink,
  footer,
  className = '',
}: GameInviteCardProps) {
  const dateTitleRow = (
    <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
      <p className="min-w-0 flex-1 break-words font-display text-base font-bold leading-tight text-brand-primary sm:text-xl md:text-2xl">
        {dateLine}
      </p>
      <p className="min-w-0 max-w-[46%] shrink-0 text-right font-display text-sm font-semibold leading-snug text-brand-primary line-clamp-2 sm:max-w-[42%] sm:text-base md:text-lg">
        {title}
      </p>
    </div>
  )

  const timeRow = timeLine ? (
    <div className="flex min-w-0 items-center gap-2">
      <p className="min-w-0 flex-1 break-all font-display text-lg font-bold leading-tight tabular-nums text-brand-text sm:break-words sm:text-2xl md:text-3xl">
        {timeLine}
      </p>
      {onShare ? (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onShare()
            }}
            aria-label={shareAriaLabel}
            className={`${adminCornerBtnClass} text-brand-primary`}
          >
            <IconShare />
          </button>
          {shareFeedback ? (
            <p className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg bg-brand-surface px-2 py-0.5 text-[10px] font-medium text-brand-muted shadow-sm">
              {shareFeedback}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null

  const divisionChips =
    skillLevel || gender ? (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {skillLevel ? (
          <span className="rounded-full bg-brand-bg-alt px-2 py-0.5 text-[10px] font-semibold text-brand-accent">
            {skillLevel}
          </span>
        ) : null}
        {gender ? (
          <span className="rounded-full border border-brand-border px-2 py-0.5 text-[10px] font-semibold text-brand-sage">
            {gender}
          </span>
        ) : null}
      </div>
    ) : null

  const scheduleBlock = (
    <>
      {dateTitleRow}
      {timeRow}
      {divisionChips}
      {statusLine ? (
        <p className="text-xs font-semibold tabular-nums text-brand-accent">{statusLine}</p>
      ) : null}
    </>
  )

  const inner = (
    <div className="min-w-0 overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
      {ruleChips.length > 0 ? (
        <div className="flex w-full min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex min-w-0 max-w-full flex-1 flex-col justify-center gap-0.5 sm:gap-1">
            {scheduleBlock}
          </div>
          <FriendlyRuleSettings chips={ruleChips} inline />
        </div>
      ) : (
        <div className="min-w-0 space-y-0.5">{scheduleBlock}</div>
      )}

      <div className="mt-4 border-t-2 border-brand-border pt-3">
        <FriendlyRosterList slots={slots} currentUserId={currentUserId} />
      </div>
    </div>
  )

  const showAdminActions = (canEdit && editTo) || (canDelete && onDelete)

  return (
    <article
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border-2 border-brand-primary/25 bg-brand-surface shadow-[0_4px_16px_-4px_rgba(96,45,36,0.22)] ${className}`}
    >
      <div className="relative min-w-0">
        <Link to={detailTo} className="block min-w-0 touch-manipulation overflow-hidden transition active:opacity-80">
          {inner}
        </Link>
        {showAdminActions ? (
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
            {canEdit && editTo ? (
              <Link
                to={editTo}
                aria-label={editAriaLabel}
                className={`${adminCornerBtnClass} text-brand-primary`}
              >
                <IconEdit />
              </Link>
            ) : null}
            {canDelete && onDelete ? (
              <button
                type="button"
                disabled={deleteBusy}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete()
                }}
                aria-label={deleteAriaLabel}
                className={`${adminCornerBtnClass} text-brand-muted disabled:opacity-50`}
              >
                <IconDelete />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {belowLink}
      {footer}
      {deleteError ? <p className="px-4 pb-3 text-xs text-red-600">{deleteError}</p> : null}
    </article>
  )
}
