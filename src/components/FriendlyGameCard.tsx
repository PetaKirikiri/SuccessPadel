import type { ReactNode } from 'react'
import { IconDelete, IconEdit, IconOpenPad } from './ButtonIcons'
import { Link } from 'react-router-dom'
import { CompetitionLayoutPreview } from './CompetitionLayoutPreview'
import { FriendlyRosterList } from './FriendlyRosterList'
import { FriendlyRuleSettings } from './FriendlyRuleSettings'
import { useTranslation } from '../hooks/useTranslation'
import type { FriendlyGameRecord } from '../lib/friendlyGames'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
  isFreeFriendly,
  isOrganizedFriendly,
} from '../lib/friendlyGames'
import {
  friendlyRosterSlots,
  friendlyRuleChips,
  friendlyScheduleDisplay,
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
  onDelete?: () => void
  deleteBusy?: boolean
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
  onDelete,
  deleteBusy = false,
}: Props) {
  const { t } = useTranslation()
  const isFree = isFreeFriendly(game)
  const slots = friendlyRosterSlots(game)
  const schedule = friendlyScheduleDisplay(game)
  const ruleChips = friendlyRuleChips(game, t)

  const organizedConfig = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const previewGames = friendlyPreviewGames(game, courtNames, game.profileAvatars)
  const previewSession = friendlyOrganizedSession(organizedConfig)
  const startsAtIso = friendlyStartsAtIso(organizedConfig)
  const showCourtBoard =
    showCourts && isAdmin && isOrganizedFriendly(game) && previewGames.length > 0 && courtNames.length > 0

  const dateTitleRow = (
    <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
      <p className="min-w-0 flex-1 break-words font-display text-base font-bold leading-tight text-brand-primary sm:text-xl md:text-2xl">
        {schedule.dateLine}
      </p>
      <p className="min-w-0 max-w-[46%] shrink-0 text-right font-display text-sm font-semibold leading-snug text-brand-primary line-clamp-2 sm:max-w-[42%] sm:text-base md:text-lg">
        {game.title}
      </p>
    </div>
  )

  const timeRow = (
    <p className="break-all font-display text-lg font-bold leading-tight tabular-nums text-brand-text sm:break-words sm:text-2xl md:text-3xl">
      {schedule.timeLine}
    </p>
  )

  const inner = (
    <div className="min-w-0 overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
      {ruleChips.length > 0 ? (
        <div className="flex w-full min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex min-w-0 max-w-full flex-1 flex-col justify-center gap-0.5 sm:gap-1">
            {dateTitleRow}
            {timeRow}
          </div>
          <FriendlyRuleSettings chips={ruleChips} inline />
        </div>
      ) : (
        <div className="min-w-0 space-y-0.5">
          {dateTitleRow}
          {timeRow}
        </div>
      )}

      <div className="mt-4 border-t-2 border-brand-border pt-3">
        <FriendlyRosterList slots={slots} currentUserId={currentUserId} />
      </div>
    </div>
  )

  const adminCornerBtnClass =
    'flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-bg-alt shadow-sm active:scale-[0.98]'

  return (
    <article
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border-2 border-brand-primary/25 bg-brand-surface shadow-[0_4px_16px_-4px_rgba(96,45,36,0.22)] ${className}`}
    >
      <div className="relative min-w-0">
        {to ? (
          <Link to={to} className="block min-w-0 overflow-hidden transition active:opacity-80">
            {inner}
          </Link>
        ) : (
          inner
        )}
        {isAdmin && to ? (
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
            <Link
              to={`/friendly/${game.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              aria-label={t('friendly.edit')}
              className={`${adminCornerBtnClass} text-brand-primary`}
            >
              <IconEdit />
            </Link>
            {onDelete ? (
              <button
                type="button"
                disabled={deleteBusy}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete()
                }}
                aria-label={t('competition.delete')}
                className={`${adminCornerBtnClass} text-brand-muted disabled:opacity-50`}
              >
                <IconDelete />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showCourtBoard ? (
        <div className="border-t-2 border-brand-border px-1 pb-2 pt-2">
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
        <div className="border-t-2 border-brand-border px-4 py-3">
          <Link
            to={`/friendly/${game.id}/pad`}
            className="brand-btn w-full py-2 text-sm font-semibold"
          >
            <IconOpenPad />
            {t('friendly.openPad')}
          </Link>
        </div>
      ) : null}

      {footer}
    </article>
  )
}
