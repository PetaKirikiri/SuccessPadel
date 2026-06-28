import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconOpenPad } from '../ButtonIcons'
import { GameBoardPreview } from '../GameBoardPreview'
import { InviteCard } from './InviteCard'
import { useTranslation } from '../../hooks/useTranslation'
import type { CompetitionRow } from '../../hooks/useCompetitions'
import { competitionIsLiveByTime } from '../../lib/competitionListCard'
import { competitionPlayUrl, shareSiteOrigin } from '../../lib/siteUrl'
import type { FriendlyGameRecord } from '../../lib/friendlyGames'
import {
  DEFAULT_FRIENDLY_ORGANIZED_CONFIG,
  canEditFriendlySession,
  friendlyOrganizedSession,
  friendlyPreviewGames,
  friendlyStartsAtIso,
  isFreeFriendly,
  isOrganizedFriendly,
} from '../../lib/friendlyGames'
import { inviteCardData, type SessionSource } from '../../lib/sessionDisplay'
import { useLocale } from '../../providers/LocaleProvider'
import { supabase } from '../../lib/supabaseClient'
import { CompetitionInviteRosterEditor } from '../roster/CompetitionInviteRosterEditor'

type CompetitionProps = {
  kind: 'competition'
  row: CompetitionRow
  isAdmin?: boolean
  userId?: string | null
  onRefresh?: () => void
}

type FriendlyProps = {
  kind: 'friendly'
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

type Props = CompetitionProps | FriendlyProps

export function InviteGameCard(props: Props) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const row = props.kind === 'competition' ? props.row : undefined
  const game = props.kind === 'friendly' ? props.game : undefined
  const isAdmin = props.isAdmin ?? false
  const currentUserId = props.kind === 'competition' ? props.userId : props.currentUserId
  const detailTo =
    props.kind === 'competition'
      ? `/competitions/${props.row.id}`
      : props.to ?? `/friendly/${props.game.id}`
  const source: SessionSource =
    props.kind === 'competition'
      ? { kind: 'competition', row: props.row }
      : { kind: 'friendly', game: props.game }
  const data = inviteCardData(source, t, { detailTo, locale })

  const canEditSetup = Boolean(props.kind === 'competition' && props.row.status !== 'complete' && isAdmin)
  const canEditRoster = Boolean(
    props.kind === 'competition' &&
      props.row.status !== 'complete' &&
      !props.row.competition_started_at &&
      isAdmin,
  )
  const canManageFriendly = Boolean(
    props.kind === 'friendly' && canEditFriendlySession(props.game, currentUserId, isAdmin),
  )

  const removeCompetition = async () => {
    if (props.kind !== 'competition') return
    const competitionRow = props.row
    const isLive = competitionIsLiveByTime(competitionRow, Date.now())
    const warning = isLive
      ? t('competition.deleteLiveConfirm', { title: competitionRow.title })
      : t('competition.deleteConfirm', { title: competitionRow.title })
    if (!window.confirm(warning)) return

    setBusy(true)
    setDeleteError(null)
    const { error: err } = await supabase.rpc('delete_competition_session', {
      p_session_id: competitionRow.id,
    })
    setBusy(false)
    if (err) setDeleteError(err.message)
    else props.onRefresh?.()
  }

  const friendlyOrganizedConfig = game?.organizedConfig ?? DEFAULT_FRIENDLY_ORGANIZED_CONFIG
  const friendlyPreview = game
    ? friendlyPreviewGames(game, props.kind === 'friendly' ? props.courtNames ?? [] : [], game.profileAvatars)
    : []
  const friendlyCourtNames = props.kind === 'friendly' ? props.courtNames ?? [] : []
  const showFriendlyCourtBoard =
    Boolean(
      game &&
        props.kind === 'friendly' &&
        props.showCourts &&
        isAdmin &&
        isOrganizedFriendly(game) &&
        friendlyPreview.length > 0 &&
        friendlyCourtNames.length > 0,
    )
  const isFree = Boolean(game && isFreeFriendly(game))
  const friendlyBelowLink =
    game && props.kind === 'friendly' ? (
      <>
        {showFriendlyCourtBoard ? (
          <div className="border-t-2 border-brand-border px-1 pb-2 pt-2">
            <GameBoardPreview
              session={friendlyOrganizedSession(friendlyOrganizedConfig)}
              games={friendlyPreview}
              eventStartsAt={friendlyStartsAtIso(friendlyOrganizedConfig)}
              gameMinutes={friendlyOrganizedConfig.gameMinutes}
              friendlySessionId={game.id}
              friendly
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              currentUserAvatarUrl={props.currentUserAvatarUrl}
            />
          </div>
        ) : null}
        {isAdmin && isFree && props.to ? (
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
    ) : undefined

  return (
    <InviteCard
      {...data}
      sessionKind={props.kind}
      detailTo={detailTo}
      competitionId={row?.id}
      currentUserId={currentUserId}
      qrUrl={row ? competitionPlayUrl(row.id) : game ? `${shareSiteOrigin()}/friendly/${game.id}` : undefined}
      qrAriaLabel={t('leaderboard.viewAlongHint')}
      canEdit={
        props.kind === 'competition'
          ? canEditSetup
          : canManageFriendly && Boolean(props.to)
      }
      editTo={
        row && canEditSetup
          ? `/competitions/${row.id}/edit`
          : game && canManageFriendly && props.kind === 'friendly' && props.to
            ? `/friendly/${game.id}/edit`
            : undefined
      }
      editAriaLabel={props.kind === 'competition' ? t('competition.edit') : t('friendly.edit')}
      rosterSection={
        props.kind === 'competition' && canEditRoster ? (
          <CompetitionInviteRosterEditor row={props.row} onSaved={props.onRefresh} />
        ) : undefined
      }
      canDelete={
        props.kind === 'competition'
          ? isAdmin
          : canManageFriendly && Boolean(props.onDelete)
      }
      onDelete={props.kind === 'competition' ? () => void removeCompetition() : props.onDelete}
      deleteBusy={props.kind === 'competition' ? busy : props.deleteBusy}
      deleteError={props.kind === 'competition' ? deleteError : undefined}
      deleteAriaLabel={t('competition.delete')}
      belowLink={
        props.kind === 'friendly' && (showFriendlyCourtBoard || (isAdmin && isFree && props.to))
          ? friendlyBelowLink
          : undefined
      }
      footer={props.kind === 'friendly' ? props.footer : undefined}
      className={props.kind === 'friendly' ? props.className : undefined}
    />
  )
}

/** @deprecated Use InviteGameCard */
export const SessionInviteCard = InviteGameCard
