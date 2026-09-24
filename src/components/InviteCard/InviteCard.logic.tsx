import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GameBoardPreview } from '../../components/GameCard/GameBoardPreview'
import { InviteCard } from './InviteCard'
import { useTranslation } from '../../hooks/useTranslation'
import type { CompetitionRow } from '../../hooks/useCompetitions'
import { shareSiteOrigin } from '../../lib/siteUrl'
import { competitionInviteUrl } from '../../lib/competitionInviteLink'
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
import { isDuoCompetition } from '../../lib/competitionFormatPresets'
import { CompetitionLevelGuide } from './CompetitionLevelGuide'
import { CompetitionPregamePanel } from './CompetitionPregamePanel'
import { useViewportBucket } from '../../contexts/ViewportContext'
import { InviteProfileAction } from './InviteProfileAction'
import { CompetitionReview } from './CompetitionReview'
import { competitionReviewAvailable } from '../../lib/competitionReview'

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
  const [pregameView, setPregameView] = useState<'players' | 'rules' | 'levels' | 'review'>('players')
  const [searchParams, setSearchParams] = useSearchParams()
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer) }, [])
  const levelHelp = useRef<HTMLButtonElement>(null)
  const closeLevelGuide = () => {
    setPregameView('players')
    requestAnimationFrame(() => levelHelp.current?.focus())
  }
  const viewport = useViewportBucket()
  const showOverview = viewport === 'tv' || viewport === 'web'

  const row = props.kind === 'competition' ? props.row : undefined
  const hasReview = competitionReviewAvailable(row, now)
  const requestedReview = searchParams.get('view') === 'review' && searchParams.get('competition') === row?.id
  useEffect(() => { setPregameView(requestedReview && hasReview ? 'review' : 'players') }, [row?.id, requestedReview, hasReview])
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
  // Singles use the draggable lineup for admins in every viewport.
  const canEditRoster = Boolean(
    props.kind === 'competition' &&
      isDuoCompetition(props.row) &&
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
      levelHelp={row && data.levelLabel ? <button ref={levelHelp} type="button" className="invite-game-card__level-help"
        aria-label={`About ${data.levelLabel} levels`} aria-expanded={pregameView === 'levels'} aria-controls={`level-guide-${row.id}`}
        onClick={event => { event.stopPropagation(); if (pregameView === 'levels') closeLevelGuide(); else setPregameView('levels') }}>?</button> : undefined}
      sessionKind={props.kind}
      detailTo={detailTo}
      competitionId={row?.id}
      currentUserId={currentUserId}
      qrUrl={row ? competitionInviteUrl(row.id) : game ? `${shareSiteOrigin()}/friendly/${game.id}` : undefined}
      qrAriaLabel={t('leaderboard.viewAlongHint')}
      accountAction={row ? <InviteProfileAction competitionId={row.id} /> : undefined}
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
          {hasReview ? <a href={`?competition=${row.id}&view=review`} role="button" aria-pressed={pregameView === 'review'} aria-controls={`review-${row.id}`}
            onKeyDown={event => { if (event.key === ' ') { event.preventDefault(); setPregameView('review') } }}
            onClick={event => { event.preventDefault(); event.stopPropagation(); setPregameView('review'); setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('competition', row.id); next.set('view', 'review'); return next }, { replace: true }) }}>Review</a> : null}
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
      rosterSection={props.kind === 'competition' ? <>
        {pregameView === 'levels' ? <CompetitionLevelGuide row={props.row} onClose={closeLevelGuide} /> : null}
        {pregameView === 'review' && hasReview ? <CompetitionReview key={props.row.id} competitionId={props.row.id} userId={currentUserId} /> : null}
        <div className="invite-game-card__pregame-pane" hidden={pregameView === 'levels' || pregameView === 'review'}>
          {canEditRoster && pregameView === 'players' && !showOverview ? (
            <InviteCardRosterEditor row={props.row} onSaved={props.onRefresh} />
          ) : (
            <CompetitionPregamePanel row={props.row} view={showOverview ? 'overview' : pregameView === 'rules' ? 'rules' : 'players'} canReorder={canEditSetup} />
          )}
        </div>
      </> : undefined}
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
