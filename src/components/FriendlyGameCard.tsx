import type { ReactNode } from 'react'
import { IconOpenPad } from './ButtonIcons'
import { Link } from 'react-router-dom'
import { CompetitionLayoutPreview } from './CompetitionLayoutPreview'
import { GameInviteCard } from './GameInviteCard'
import { useTranslation } from '../hooks/useTranslation'
import type { FriendlyGameRecord } from '../lib/friendlyGames'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  canEditFriendlySession,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
  isFreeFriendly,
  isOrganizedFriendly,
} from '../lib/friendlyGames'
import {
  friendlyDivisionLabels,
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
  const canEdit = canEditFriendlySession(game, currentUserId, isAdmin)
  const slots = friendlyRosterSlots(game)
  const schedule = friendlyScheduleDisplay(game)
  const ruleChips = friendlyRuleChips(game, t)
  const { skillLevel, gender } = friendlyDivisionLabels(game)

  const organizedConfig = game.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const previewGames = friendlyPreviewGames(game, courtNames, game.profileAvatars)
  const previewSession = friendlyOrganizedSession(organizedConfig)
  const startsAtIso = friendlyStartsAtIso(organizedConfig)
  const showCourtBoard =
    showCourts && isAdmin && isOrganizedFriendly(game) && previewGames.length > 0 && courtNames.length > 0

  const detailTo = to ?? `/friendly/${game.id}`

  const belowLink = (
    <>
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
    </>
  )

  return (
    <GameInviteCard
      title={game.title}
      dateLine={schedule.dateLine}
      timeLine={schedule.timeLine}
      detailTo={detailTo}
      slots={slots}
      currentUserId={currentUserId}
      ruleChips={ruleChips}
      skillLevel={skillLevel}
      gender={gender}
      canEdit={canEdit && Boolean(to)}
      editTo={canEdit && to ? `/friendly/${game.id}/edit` : undefined}
      editAriaLabel={t('friendly.edit')}
      canDelete={isAdmin && Boolean(onDelete)}
      onDelete={onDelete}
      deleteBusy={deleteBusy}
      deleteAriaLabel={t('competition.delete')}
      belowLink={showCourtBoard || (isAdmin && isFree && to) ? belowLink : undefined}
      footer={footer}
      className={className}
    />
  )
}
