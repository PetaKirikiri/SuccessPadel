import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../hooks/useTranslation'
import { useGamesGenderFilterControls } from '../../contexts/GamesGenderFilterContext'
import { RosterList } from '../roster/RosterList'
import { RuleChipGrid } from '../RuleChipGrid'
import { GamesGenderFilterButtons } from '../hub/GamesGenderFilterButtons'
import { IconDelete, IconEdit } from '../ButtonIcons'
import type { CompetitionTeamSlot } from '../../lib/competitionGameDisplay'
import type { RosterSlot, RuleChip } from '../../lib/friendlyGameDisplay'
import { useInviteCarouselNav } from './InviteCardCarousel'

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

function InviteCarouselNavButton({
  direction,
  onClick,
  disabled,
  ariaLabel,
}: {
  direction: 'prev' | 'next'
  onClick: () => void
  disabled: boolean
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className="invite-carousel-header-nav flex shrink-0 items-center justify-center rounded-full border border-brand-primary/35 bg-brand-bg-alt font-bold leading-none text-brand-primary shadow-sm transition active:scale-95 disabled:opacity-30"
    >
      {direction === 'prev' ? '‹' : '›'}
    </button>
  )
}

function stopCardNav(e: { stopPropagation: () => void }) {
  e.stopPropagation()
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
  const { t } = useTranslation()
  const carouselNav = useInviteCarouselNav()
  const genderControls = useGamesGenderFilterControls()
  const showAdminActions = (canEdit && editTo) || (canDelete && onDelete)
  const showCarouselNav = Boolean(carouselNav?.show)

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

  const titleBlock = (
    <Link
      to={detailTo}
      className="invite-game-card__title-link touch-manipulation transition active:opacity-80"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="invite-game-card__schedule-date">{dateCompact}</p>
      {timeLine ? <p className="invite-game-card__schedule-time">{timeLine}</p> : null}
      <p className="invite-game-card__level">{cleanTitle}</p>
    </Link>
  )

  const genderRail = genderControls ? (
    <div
      className="invite-game-card__left-rail"
      onClick={stopCardNav}
      onKeyDown={stopCardNav}
    >
      <div className="invite-card-gender-controls">
        <GamesGenderFilterButtons
          compact
          value={genderControls.gender}
          onChange={genderControls.setGender}
        />
      </div>
    </div>
  ) : (
    <div className="invite-game-card__header-spacer" aria-hidden />
  )

  const rightRail =
    showAdminActions || ruleChips.length > 0 ? (
      <div
        className="invite-game-card__right-rail"
        onClick={stopCardNav}
        onKeyDown={stopCardNav}
      >
        {showAdminActions ? (
          <div className="invite-game-card__admin invite-card-admin-controls">
            {adminActions}
          </div>
        ) : null}
        {ruleChips.length > 0 ? (
          <div className="invite-game-card__badges">
            <RuleChipGrid chips={ruleChips} compact />
          </div>
        ) : null}
      </div>
    ) : (
      <div className="invite-game-card__header-spacer" aria-hidden />
    )

  const headerContent = (
    <header className="invite-game-card__header">
      {genderRail}
      <div className="invite-game-card__banner-center">
        {showCarouselNav ? (
          <InviteCarouselNavButton
            direction="prev"
            onClick={carouselNav!.onPrev}
            disabled={carouselNav!.atStart}
            ariaLabel={t('competition.prevGame')}
          />
        ) : null}
        <div className="invite-game-card__title-slot">{titleBlock}</div>
        {showCarouselNav ? (
          <InviteCarouselNavButton
            direction="next"
            onClick={carouselNav!.onNext}
            disabled={carouselNav!.atEnd}
            ariaLabel={t('competition.nextGame')}
          />
        ) : null}
      </div>
      {rightRail}
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
      className={`invite-game-card relative min-h-0 w-full min-w-0 max-w-full flex-1 touch-manipulation transition active:opacity-95 ${
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
