import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DuoTeamRosterList } from './DuoTeamRosterList'
import { FriendlyRosterList } from './FriendlyRosterList'
import { RuleChipGrid } from './RuleChipGrid'
import type { CompetitionTeamSlot } from '../lib/competitionGameDisplay'
import type { RosterSlot, RuleChip } from '../lib/friendlyGameDisplay'

export type InviteCardProps = {
  title: string
  dateLine: string
  timeLine: string
  detailTo: string
  slots: RosterSlot[]
  duoTeams?: CompetitionTeamSlot[] | null
  competitionId?: string | null
  currentUserId?: string | null
  ruleChips?: RuleChip[]
  scoringHeadline?: string | null
  qrUrl?: string | null
  qrAriaLabel?: string
  canEdit?: boolean
  editTo?: string
  editAriaLabel?: string
  rosterSection?: ReactNode
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

const adminDangerBtnClass =
  'inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-bg-alt px-3 text-[11px] font-black uppercase tracking-wide text-brand-muted shadow-sm active:scale-[0.98]'
const adminTextBtnClass =
  'inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-brand-primary/35 bg-brand-bg-alt px-3 text-[11px] font-black uppercase tracking-wide text-brand-primary shadow-sm active:scale-[0.98]'

function isInteractiveCardTarget(target: EventTarget | null, card: HTMLElement): boolean {
  if (!(target instanceof HTMLElement)) return false
  const interactive = target.closest(
    'a, button, input, select, textarea, label, [role="button"], [role="link"], [contenteditable="true"]',
  )
  return Boolean(interactive && interactive !== card)
}

export function InviteCard({
  title,
  dateLine,
  timeLine,
  detailTo,
  slots,
  duoTeams = null,
  competitionId = null,
  currentUserId,
  ruleChips = [],
  canEdit = false,
  editTo,
  editAriaLabel,
  rosterSection,
  canDelete = false,
  onDelete,
  deleteBusy = false,
  deleteError,
  deleteAriaLabel,
  belowLink,
  footer,
  className = '',
}: InviteCardProps) {
  const navigate = useNavigate()
  const showAdminActions = (canEdit && editTo) || (canDelete && onDelete)

  const openDetail = () => {
    if (detailTo) navigate(detailTo)
  }

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (!detailTo || isInteractiveCardTarget(event.target, event.currentTarget)) return
    openDetail()
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!detailTo || isInteractiveCardTarget(event.target, event.currentTarget)) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDetail()
    }
  }

  const adminActions = showAdminActions ? (
    <>
      {canEdit && editTo ? (
        <Link
          to={editTo}
          aria-label={editAriaLabel}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={adminTextBtnClass}
        >
          Edit
        </Link>
      ) : null}
      {canDelete && onDelete ? (
        <button
          type="button"
          disabled={deleteBusy}
          aria-label={deleteAriaLabel}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`${adminDangerBtnClass} disabled:opacity-50`}
        >
          Delete
        </button>
      ) : null}
    </>
  ) : null

  const dateParts = dateLine.split(/\s+/).filter(Boolean)
  const dateCompact = dateParts.length >= 3 ? `${dateParts[0]} ${dateParts[1]} ${dateParts[2]}` : dateLine

  const headerRow = (
    <div className="w-full min-w-0 space-y-2">
      {showAdminActions ? (
        <div className="flex w-full justify-end gap-1.5">{adminActions}</div>
      ) : null}
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(13rem,0.9fr)_minmax(22rem,1.6fr)] lg:items-start">
        <div className="min-w-0">
          <Link
            to={detailTo}
            className="block min-w-0 touch-manipulation transition active:opacity-80"
          >
            <div className="grid min-w-0 gap-1.5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-baseline lg:block">
              <p className="whitespace-nowrap font-display text-base font-bold leading-tight text-brand-primary sm:text-xl lg:text-2xl">
                {dateCompact}
              </p>
              {timeLine ? (
                <p className="whitespace-nowrap font-display text-sm font-bold leading-tight tabular-nums text-brand-text sm:text-lg lg:text-xl">
                  {timeLine}
                </p>
              ) : null}
              <p className="min-w-0 font-display text-lg font-semibold leading-tight text-brand-primary sm:text-xl lg:text-2xl">
                {title}
              </p>
            </div>
          </Link>
        </div>
        {ruleChips.length > 0 ? (
          <div className="min-w-0 self-start">
            <RuleChipGrid chips={ruleChips} inline />
          </div>
        ) : null}
      </div>
    </div>
  )

  const rosterContent =
    rosterSection ??
    (duoTeams ? (
      <DuoTeamRosterList
        teams={duoTeams}
        currentUserId={currentUserId}
        competitionId={competitionId}
      />
    ) : (
      <FriendlyRosterList
        slots={slots}
        currentUserId={currentUserId}
        competitionId={competitionId}
      />
    ))

  return (
    <article
      className={`relative w-full min-w-0 max-w-full overflow-hidden bg-transparent touch-manipulation transition active:opacity-95 ${
        detailTo ? 'cursor-pointer' : ''
      } ${className}`}
      role={detailTo ? 'link' : undefined}
      tabIndex={detailTo ? 0 : undefined}
      aria-label={detailTo ? `${title}, ${dateLine}` : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="relative min-w-0">
        <div className="min-w-0 overflow-hidden px-1 py-1 sm:px-2 sm:py-2">
          {headerRow}
          <div className="mt-4 border-t-2 border-brand-border pt-3">{rosterContent}</div>
        </div>
      </div>

      {belowLink}
      {footer}
      {deleteError ? <p className="px-4 pb-3 text-xs text-red-600">{deleteError}</p> : null}
    </article>
  )
}
