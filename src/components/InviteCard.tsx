import type { ReactNode } from 'react'
import { IconDelete, IconEdit, IconShare } from './ButtonIcons'
import { Link } from 'react-router-dom'
import { FriendlyRosterList } from './FriendlyRosterList'
import { RuleChipGrid } from './RuleChipGrid'
import { InviteCardQr } from './InviteCardQr'
import type { RosterSlot, RuleChip } from '../lib/friendlyGameDisplay'
import { genderFromRuleChips, inviteBannerForGender } from '../lib/inviteBanners'

export type InviteCardProps = {
  title: string
  dateLine: string
  timeLine: string
  detailTo: string
  slots: RosterSlot[]
  currentUserId?: string | null
  ruleChips?: RuleChip[]
  statusLine?: string | null
  onShare?: () => void
  shareFeedback?: string | null
  shareAriaLabel?: string
  qrUrl?: string | null
  qrAriaLabel?: string
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
  /** Men / Women / Mixed — selects the top banner when a match exists. */
  gender?: string | null
}

const adminCornerBtnClass =
  'flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-bg-alt shadow-sm active:scale-[0.98]'

export function InviteCard({
  title,
  dateLine,
  timeLine,
  detailTo,
  slots,
  currentUserId,
  ruleChips = [],
  statusLine,
  onShare,
  shareFeedback,
  shareAriaLabel,
  qrUrl,
  qrAriaLabel,
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
  gender = null,
}: InviteCardProps) {
  const shareButton = onShare ? (
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
  ) : null

  const inviteActions =
    onShare || qrUrl ? (
      <div className="flex items-center justify-end gap-2 pt-0.5">
        {qrUrl ? <InviteCardQr url={qrUrl} title={qrAriaLabel} /> : null}
        {shareButton}
      </div>
    ) : null

  const scheduleBlock = (
    <div className="min-w-0 space-y-1">
      <p className="font-display text-base font-bold leading-tight text-brand-primary sm:text-xl md:text-2xl">
        {dateLine}
      </p>
      <p className="break-words font-display text-sm font-semibold leading-snug text-brand-primary sm:text-base md:text-lg">
        {title}
      </p>
      {timeLine ? (
        <p className="break-all font-display text-lg font-bold leading-tight tabular-nums text-brand-text sm:break-words sm:text-2xl md:text-3xl">
          {timeLine}
        </p>
      ) : null}
      {inviteActions}
      {statusLine ? (
        <p className="text-xs font-semibold tabular-nums text-brand-accent">{statusLine}</p>
      ) : null}
    </div>
  )

  const inner = (
    <div className="min-w-0 overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
      {ruleChips.length > 0 ? (
        <div className="flex w-full min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex min-w-0 max-w-full flex-1 flex-col justify-center gap-0.5 sm:gap-1">
            {scheduleBlock}
          </div>
          <RuleChipGrid chips={ruleChips} inline />
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

  const bannerSrc = inviteBannerForGender(gender ?? genderFromRuleChips(ruleChips))
  const banner = bannerSrc ? (
    <div className="w-full overflow-hidden bg-brand-bg-alt" style={{ aspectRatio: '1024 / 344' }}>
      <img
        src={bannerSrc}
        alt=""
        className="h-full w-full object-cover object-[center_35%]"
        decoding="async"
      />
    </div>
  ) : null

  return (
    <article
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border-2 border-brand-primary/25 bg-brand-surface shadow-[0_4px_16px_-4px_rgba(96,45,36,0.22)] ${className}`}
    >
      {banner}
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
