import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconAdd } from './ButtonIcons'
import { FriendlyDeleteConfirm } from './FriendlyDeleteConfirm'
import { FriendlyGameCard } from './FriendlyGameCard'
import { GamesHubEmpty, GamesHubLoading } from './GamesHubView'
import { useAuth } from '../hooks/useAuth'
import { useLineClientProfile } from '../hooks/useLineClientProfile'
import { useTranslation } from '../hooks/useTranslation'
import type { FriendlyGameRecord } from '../lib/friendlyGames'
import { deleteFriendlySession } from '../lib/friendlyServer'

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

  if (games.length === 0) {
    return (
      <GamesHubEmpty>
        <p className="text-brand-muted">
          {past ? t('competition.noPastGames') : t('competition.noCurrentGames')}
        </p>
        {!past && isAdmin ? (
          <>
            <Link to="/friendly/new" className="brand-btn px-6 py-2">
              <IconAdd />
              {t('friendly.addGame')}
            </Link>
            <p className="text-xs text-brand-muted">{t('competition.tapPlusHint')}</p>
          </>
        ) : !past ? (
          <p className="text-xs text-brand-muted">{t('competition.checkBackHint')}</p>
        ) : null}
      </GamesHubEmpty>
    )
  }

  return (
    <>
      {deleteError ? <p className="mb-2 text-xs text-red-600">{deleteError}</p> : null}
      <ul className="m-0 w-full min-w-0 max-w-full list-none space-y-4 p-0">
        {games.map((game) => (
          <li key={game.id} className="w-full min-w-0 max-w-full">
            <FriendlyGameCard
              game={game}
              to={`/friendly/${game.id}`}
              currentUserId={user?.id}
              currentUserAvatarUrl={headerAvatar}
              isAdmin={isAdmin}
              onDelete={() => setPendingDelete(game)}
              deleteBusy={deleteBusyId === game.id}
              className={deleteBusyId === game.id ? 'pointer-events-none opacity-60' : ''}
            />
          </li>
        ))}
      </ul>
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
