import { useMemo, useState } from 'react'
import { FriendlyDeleteConfirm } from './FriendlyDeleteConfirm'
import { GamesGenderFilterEmptyBar } from './GamesGenderFilterButtons'
import { InviteCardCarousel } from './InviteCardCarousel'
import { SessionInviteCard } from './SessionInviteCard'
import { GamesHubEmpty, GamesHubLoading } from './GamesHubView'
import { useGamesGenderFilter } from '../contexts/GamesGenderFilterContext'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useTranslation } from '../hooks/useTranslation'
import { canEditFriendlySession, type FriendlyGameRecord } from '../lib/friendlyGames'
import { deleteFriendlySession } from '../lib/friendlyServer'
import { friendlyDivisionLabels } from '../lib/friendlyGameDisplay'
import { matchesGamesGenderFilter, genderFilterLabel } from '../lib/gamesGenderFilter'

type Props = {
  games: FriendlyGameRecord[]
  loading: boolean
  past?: boolean
  isAdmin?: boolean
  onRefresh?: () => void
}

export function FriendlyGamesList({
  games,
  loading,
  past = false,
  isAdmin = false,
  onRefresh,
}: Props) {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const lineClient = useLineClientProfile()
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<FriendlyGameRecord | null>(null)
  const headerAvatar = profile?.avatar_url ?? lineClient.pictureUrl ?? null
  const genderFilter = useGamesGenderFilter()
  const filteredGames = useMemo(() => {
    if (!genderFilter) return games
    return games.filter((game) =>
      matchesGamesGenderFilter(friendlyDivisionLabels(game).gender, genderFilter),
    )
  }, [games, genderFilter])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const game = pendingDelete
    setDeleteBusyId(game.id)
    setDeleteError(null)
    const err = await deleteFriendlySession(game.id)
    setDeleteBusyId(null)
    if (err) {
      setDeleteError(err)
      return
    }
    setPendingDelete(null)
    onRefresh?.()
  }

  if (loading) return <GamesHubLoading />

  if (filteredGames.length === 0) {
    return (
      <GamesHubEmpty>
        <GamesGenderFilterEmptyBar />
        <p className="text-brand-muted">
          {genderFilter
            ? t('competition.noGamesForGender', {
                gender: genderFilterLabel(genderFilter, t),
              })
            : past
              ? t('competition.noPastGames')
              : t('competition.noCurrentGames')}
        </p>
        {!past && !isAdmin && games.length === 0 ? (
          <p className="text-xs text-brand-muted">{t('competition.checkBackHint')}</p>
        ) : null}
      </GamesHubEmpty>
    )
  }

  return (
    <>
      {deleteError ? <p className="mb-2 text-xs text-red-600">{deleteError}</p> : null}
      <InviteCardCarousel>
        {filteredGames.map((game) => (
          <li key={game.id} className="invite-card-carousel-item">
            <SessionInviteCard
              kind="friendly"
              game={game}
              to={`/friendly/${game.id}`}
              currentUserId={user?.id}
              currentUserAvatarUrl={headerAvatar}
              isAdmin={isAdmin}
              onDelete={
                canEditFriendlySession(game, user?.id, isAdmin)
                  ? () => setPendingDelete(game)
                  : undefined
              }
              deleteBusy={deleteBusyId === game.id}
              className={deleteBusyId === game.id ? 'pointer-events-none opacity-60' : ''}
            />
          </li>
        ))}
      </InviteCardCarousel>
      {pendingDelete ? (
        <FriendlyDeleteConfirm
          title={pendingDelete.title}
          busy={deleteBusyId === pendingDelete.id}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  )
}
