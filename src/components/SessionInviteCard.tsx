import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconOpenPad } from './ButtonIcons'
import { GameBoardPreview } from './GameBoardPreview'
import { InviteCard } from './InviteCard'
import { useTranslation } from '../hooks/useTranslation'
import { translateCountdownLabel, translatePhaseBadge } from '../i18n/competitionLabels'
import type { TranslateFn } from '../i18n'
import type { CompetitionRow } from '../hooks/useCompetitions'
import {
  competitionCardPhase,
  competitionCountdown,
  competitionIsLiveByTime,
} from '../lib/competitionListCard'
import { shareCompetitionInvite } from '../lib/competitionLink'
import { competitionPlayUrl, shareSiteOrigin } from '../lib/siteUrl'
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
import { inviteCardData, type SessionSource } from '../lib/sessionDisplay'
import { supabase } from '../lib/supabaseClient'

type CompetitionProps = {
  kind: 'competition'
  row: CompetitionRow
  isAdmin?: boolean
  userId?: string | null
  onRefresh?: () => void
  statusLine?: string | null
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

export function SessionInviteCard(props: Props) {
  const { t } = useTranslation()

  if (props.kind === 'competition') {
    return <CompetitionInviteCard {...props} t={t} />
  }
  return <FriendlyInviteCard {...props} t={t} />
}

function CompetitionInviteCard({
  row,
  isAdmin = false,
  userId,
  onRefresh,
  statusLine: statusLineOverride,
  t,
}: CompetitionProps & { t: TranslateFn }) {
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const source: SessionSource = { kind: 'competition', row }
  const data = useMemo(() => inviteCardData(source, t), [row, t])
  const phase = useMemo(() => competitionCardPhase(row, now), [row, now])
  const countdown = useMemo(() => competitionCountdown(row, now), [row, now])
  const badge = translatePhaseBadge(t, phase)
  const isLive = competitionIsLiveByTime(row, now)

  const statusLine =
    statusLineOverride ??
    ([badge, countdown && `${translateCountdownLabel(t, countdown.label)} ${countdown.value}`]
      .filter(Boolean)
      .join(' · ') ||
      null)

  const shareInvite = async () => {
    const result = await shareCompetitionInvite({
      sessionId: row.id,
      title: row.title,
      text: t('competition.shareInviteMessage', { title: row.title }),
    })
    if (result === 'shared' || result === 'copied') {
      setShareFeedback(t('competition.linkCopied'))
      setTimeout(() => setShareFeedback(null), 2000)
    } else if (result === 'failed') {
      setShareFeedback(t('competition.copyFailed'))
      setTimeout(() => setShareFeedback(null), 2000)
    }
  }

  const remove = async () => {
    const warning = isLive
      ? t('competition.deleteLiveConfirm', { title: row.title })
      : t('competition.deleteConfirm', { title: row.title })
    if (!window.confirm(warning)) return

    setBusy(true)
    setDeleteError(null)
    const { error: err } = await supabase.rpc('delete_competition_session', {
      p_session_id: row.id,
    })
    setBusy(false)
    if (err) setDeleteError(err.message)
    else onRefresh?.()
  }

  return (
    <InviteCard
      {...data}
      currentUserId={userId}
      statusLine={statusLine}
      onShare={() => void shareInvite()}
      shareFeedback={shareFeedback}
      shareAriaLabel={t('competition.shareInvite')}
      qrUrl={competitionPlayUrl(row.id)}
      qrAriaLabel={t('leaderboard.viewAlongHint')}
      canEdit={isAdmin}
      editTo={isAdmin ? `/competitions/${row.id}/edit` : undefined}
      editAriaLabel={t('competition.edit')}
      canDelete={isAdmin}
      onDelete={() => void remove()}
      deleteBusy={busy}
      deleteError={deleteError}
      deleteAriaLabel={t('competition.delete')}
    />
  )
}

function FriendlyInviteCard({
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
  t,
}: FriendlyProps & { t: TranslateFn }) {
  const isFree = isFreeFriendly(game)
  const canEdit = canEditFriendlySession(game, currentUserId, isAdmin)
  const source: SessionSource = { kind: 'friendly', game }
  const data = useMemo(() => inviteCardData(source, t, { detailTo: to }), [game, t, to])

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
          <GameBoardPreview
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
    <InviteCard
      {...data}
      detailTo={detailTo}
      currentUserId={currentUserId}
      qrUrl={`${shareSiteOrigin()}/friendly/${game.id}`}
      qrAriaLabel={t('leaderboard.viewAlongHint')}
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
