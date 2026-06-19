import type { ReactNode } from 'react'
import { IconDelete, IconEdit } from './ButtonIcons'
import { Link } from 'react-router-dom'
import { DuoTeamRosterList } from './DuoTeamRosterList'
import { FriendlyRosterList } from './FriendlyRosterList'
import { RuleChipGrid } from './RuleChipGrid'
import { InviteCardQr } from './InviteCardQr'
import type { CompetitionTeamSlot } from '../lib/competitionGameDisplay'
import type { RosterSlot, RuleChip } from '../lib/friendlyGameDisplay'
import { genderFromRuleChips, inviteBannerForSession } from '../lib/inviteBanners'

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

const adminCornerBtnClass =
  'flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-bg-alt shadow-sm active:scale-[0.98]'

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
  scoringHeadline = null,
  qrUrl,
  qrAriaLabel,
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
  gender = null,
}: InviteCardProps) {
  const headerRow = (
    <div className="flex w-full min-w-0 items-start gap-2 sm:gap-3">
      <div className="min-w-0 shrink space-y-1">
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
      </div>
      {qrUrl ? (
        <div className="w-[4.75rem] shrink-0 sm:w-24 md:w-28">
          <InviteCardQr url={qrUrl} title={qrAriaLabel} />
        </div>
      ) : null}
      {ruleChips.length > 0 ? (
        <div className="min-w-0 flex-1">
          <RuleChipGrid chips={ruleChips} inline />
        </div>
      ) : null}
    </div>
  )

  const inner = (
    <div className="min-w-0 overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
      {headerRow}

      <div className="mt-4 border-t-2 border-brand-border pt-3">
        {rosterSection ??
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
          ))}
      </div>
    </div>
  )

  const showAdminActions = (canEdit && editTo) || (canDelete && onDelete)

  const bannerSrc = inviteBannerForSession({
    gender: gender ?? genderFromRuleChips(ruleChips),
    isDuo: Boolean(duoTeams?.length),
  })
  const banner = bannerSrc ? (
    <div className="relative aspect-[1024/172] w-full overflow-hidden bg-brand-bg-alt">
      <img
        src={bannerSrc}
        alt=""
        className="h-full w-full object-cover object-[center_30%]"
        decoding="async"
      />
      {scoringHeadline ? (
        <div className="pointer-events-none absolute right-3 top-3 z-40">
          <div className="game-card-racetrack rounded-xl">
            <div className="rounded-[10px] bg-brand-surface px-3 py-1.5 shadow-sm">
              <p className="whitespace-nowrap font-display text-sm font-bold leading-tight text-brand-primary sm:text-base">
                {scoringHeadline}
              </p>
            </div>
          </div>
        </div>
      ) : null}
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
