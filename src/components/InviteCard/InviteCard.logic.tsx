import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GameBoardPreview } from '../../components/GameCard/GameBoardPreview'
import { InviteCard } from './InviteCard'
import { useTranslation } from '../../hooks/useTranslation'
import type { CompetitionRow } from '../../hooks/useCompetitions'
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
import { InviteCardRosterEditor } from './InviteCardRosterEditor'
import { CompetitionPregamePanel } from './CompetitionPregamePanel'
import { useViewportBucket } from '../../contexts/ViewportContext'
import { InviteProfileAction } from './InviteProfileAction'

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
  const [pregameView, setPregameView] = useState<'players' | 'rules'>('players')
  const viewport = useViewportBucket()
  const showOverview = viewport === 'tv' || viewport === 'web'

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
      accountAction={row ? <InviteProfileAction /> : undefined}
      headerAction={
        row ? (
          <div className="invite-game-card__header-links" aria-label="Competition navigation">
          <a href={`#players-${row.id}`} role="button" aria-pressed={pregameView === 'players'}
            aria-controls={`players-${row.id}`}
            onKeyDown={(event) => { if (event.key === ' ') { event.preventDefault(); setPregameView('players') } }}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); setPregameView('players') }}>
            Players
          </a>
          <a
            className="invite-game-card__rules-jump"
            href={`#tonights-rules-${row.id}`}
            role="button"
            aria-pressed={pregameView === 'rules'}
            aria-controls={`tonights-rules-${row.id}`}
            onKeyDown={(event) => { if (event.key === ' ') { event.preventDefault(); setPregameView('rules') } }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setPregameView('rules')
            }}
          >
            Rules
          </a>
          <Link className="invite-game-card__matches-link" to={detailTo}>Matches</Link>
          </div>
        ) : undefined
      }
      canEdit={
        props.kind === 'competition'
          ? false
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
        props.kind === 'competition' && canEditRoster && pregameView === 'players' && !showOverview ? (
          <InviteCardRosterEditor row={props.row} onSaved={props.onRefresh} />
        ) : props.kind === 'competition' ? (
          <CompetitionPregamePanel row={props.row} view={showOverview ? 'overview' : pregameView} canReorder={canEditSetup} />
        ) : undefined
      }
      canDelete={
        props.kind === 'competition'
          ? false
          : canManageFriendly && Boolean(props.onDelete)
      }
      onDelete={props.kind === 'friendly' ? props.onDelete : undefined}
      deleteBusy={props.kind === 'friendly' ? props.deleteBusy : undefined}
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
