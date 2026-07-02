import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RosterList } from './RosterList'
import { IconDelete, IconEdit } from '../../shared/Button/ButtonIcons'
import type { CompetitionTeamSlot } from '../../lib/competitionGameDisplay'
import type { RosterSlot, RuleChip } from '../../lib/friendlyGameDisplay'
import { inviteCardRootClass } from './InviteCard.styles'
import { InviteCardHeaderBadges } from './InviteCardHeaderBadges'
import { InviteCardHeaderTitle } from './InviteCardHeaderTitle'

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
  sessionKind?: 'friendly' | 'competition'
  gender?: string | null
}

function isInteractiveCardTarget(target: EventTarget | null, card: HTMLElement): boolean {
  if (!(target instanceof HTMLElement)) return false
  const interactive = target.closest(
    'a, button, input, select, textarea, label, [role="button"], [role="link"], [contenteditable="true"]',
  )
  return Boolean(interactive && interactive !== card)
}

function cleanInviteTitle(title: string, dateLine: string, timeLine: string): string {
  const dateParts = dateLine.split(/\s+/).filter(Boolean)
  const compactDate = dateParts.length >= 3 ? `${dateParts[1]} ${dateParts[2]}` : dateLine
  const times = timeLine.match(/\d{1,2}:\d{2}/g) ?? []

  const staleDetail = new Set([
    dateLine.trim().toLowerCase(),
    compactDate.trim().toLowerCase(),
    ...times.map((time) => time.toLowerCase()),
  ].filter(Boolean))

  const cleaned = title
    .split(/\s*[·•]\s*/)
    .map((part) => part.trim())
    .filter((part) => {
      const normalized = part.toLowerCase()
      if (!normalized) return false
      if (staleDetail.has(normalized)) return false
      if (/^\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?$/.test(part)) return false
      if (/^\d{1,2}\s+[a-z]{3,}$/i.test(part)) return false
      return true
    })
    .join(' · ')

  return cleaned || title
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
  sessionKind,
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
          className="invite-card-admin-btn invite-card-admin-btn--edit"
        >
          <IconEdit className="invite-card-admin-btn__icon" />
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
          className="invite-card-admin-btn invite-card-admin-btn--delete disabled:opacity-50"
        >
          <IconDelete className="invite-card-admin-btn__icon" />
        </button>
      ) : null}
    </>
  ) : null

  const dateParts = dateLine.split(/\s+/).filter(Boolean)
  const dateCompact = dateParts.length >= 3 ? `${dateParts[0]} ${dateParts[1]} ${dateParts[2]}` : dateLine
  const cleanTitle = cleanInviteTitle(title, dateLine, timeLine)

  const headerContent = (
    <header className="invite-game-card__header">
      <InviteCardHeaderTitle
        detailTo={detailTo}
        dateLine={dateCompact}
        timeLine={timeLine}
        titleLine={cleanTitle}
        adminActions={adminActions}
      />
      <InviteCardHeaderBadges chips={ruleChips} />
    </header>
  )

  const rosterContent =
    rosterSection ??
    (duoTeams ? (
      <RosterList
        format="duo"
        teams={duoTeams}
        currentUserId={currentUserId}
        competitionId={competitionId}
        prominent
        fill
      />
    ) : (
      <RosterList
        format="flat"
        slots={slots}
        currentUserId={currentUserId}
        competitionId={competitionId}
        prominent
        fill
      />
    ))

  return (
    <article
      className={`${inviteCardRootClass} ${
        detailTo ? 'cursor-pointer' : ''
      } ${className}`}
      data-kind={sessionKind}
      role={detailTo ? 'link' : undefined}
      tabIndex={detailTo ? 0 : undefined}
      aria-label={detailTo ? `${title}, ${dateLine}` : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="invite-game-card__frame">
        {headerContent}
        <div className="invite-game-card__roster">
          {rosterContent}
        </div>
      </div>

      {belowLink}
      {footer}
      {deleteError ? <p className="px-4 pb-3 text-xs text-red-600">{deleteError}</p> : null}
    </article>
  )
}
