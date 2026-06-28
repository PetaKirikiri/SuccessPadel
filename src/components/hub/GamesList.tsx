import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FriendlyDeleteConfirm } from '../FriendlyDeleteConfirm'
import { IconAdd } from '../ButtonIcons'
import { IconHubCurrent, IconHubPast, shellTabClass } from '../ShellTabIcons'
import { useGamesGenderFilter } from '../../contexts/GamesGenderFilterContext'
import { useAuth } from '../../hooks/useAuth'
import type { CompetitionRow } from '../../hooks/useCompetitions'
import { useLineClientProfile } from '../../hooks/useLineClientProfile'
import { useTranslation } from '../../hooks/useTranslation'
import type { TranslateFn } from '../../i18n'
import { competitionIsPast } from '../../lib/competitionListCard'
import { canEditFriendlySession, type FriendlyGameRecord } from '../../lib/friendlyGames'
import { deleteFriendlySession } from '../../lib/friendlyServer'
import { friendlyDivisionLabels } from '../../lib/friendlyGameDisplay'
import { matchesGamesGenderFilter, genderFilterLabel } from '../../lib/gamesGenderFilter'
import { InviteCardCarousel } from '../invite/InviteCardCarousel'
import { InviteGameCard } from '../invite/SessionInviteCard'
import { GamesHubEmpty, GamesHubLoading } from './GamesHubView'

export type GamesListTab = 'current' | 'past'

type SharedProps = {
  loading?: boolean
  past?: boolean
  isAdmin?: boolean
  listTab?: GamesListTab
  showListTabs?: boolean
}

type FriendlyProps = SharedProps & {
  mode: 'friendly'
  games: FriendlyGameRecord[]
  onRefresh?: () => void
}

type CompetitiveProps = SharedProps & {
  mode: 'competitive'
  rows: CompetitionRow[]
  error?: string | null
  userId?: string
  onRefresh: () => void
}

type Props = FriendlyProps | CompetitiveProps

export function splitCompetitionRows(rows: CompetitionRow[], now = Date.now()) {
  const current: CompetitionRow[] = []
  const past: CompetitionRow[] = []
  for (const row of rows) {
    if (competitionIsPast(row, now)) past.push(row)
    else current.push(row)
  }
  past.sort((a, b) => {
    const ta = Date.parse(a.competition_started_at ?? a.starts_at ?? '')
    const tb = Date.parse(b.competition_started_at ?? b.starts_at ?? '')
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
  })
  return { currentRows: current, pastRows: past }
}

function ListTabs({
  tab,
  onTab,
  currentCount,
  pastCount,
  t,
}: {
  tab: GamesListTab
  onTab: (t: GamesListTab) => void
  currentCount: number
  pastCount: number
  t: TranslateFn
}) {
  return (
    <div className="game-dock-inner">
      <button
        type="button"
        onClick={() => onTab('current')}
        className={shellTabClass(tab === 'current', 'competition')}
      >
        <IconHubCurrent />
        <span className="truncate text-xs leading-tight md:text-sm">
          {t('competition.currentGames')}
          {currentCount > 0 ? ` (${currentCount})` : ''}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onTab('past')}
        className={shellTabClass(tab === 'past', 'rank')}
      >
        <IconHubPast />
        <span className="truncate text-xs leading-tight md:text-sm">
          {t('competition.pastGames')}
          {pastCount > 0 ? ` (${pastCount})` : ''}
        </span>
      </button>
    </div>
  )
}

export function GamesList(props: Props) {
  if (props.mode === 'friendly') {
    return <FriendlyGamesListBody {...props} />
  }
  return <CompetitiveGamesListBody {...props} />
}

function FriendlyGamesListBody({
  games,
  loading = false,
  past = false,
  isAdmin = false,
  onRefresh,
}: FriendlyProps) {
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
    <div className="flex min-h-0 flex-1 flex-col">
      {deleteError ? <p className="mb-2 shrink-0 text-xs text-red-600">{deleteError}</p> : null}
      <InviteCardCarousel className="min-h-0 flex-1">
        {filteredGames.map((game) => (
          <li key={game.id} className="invite-card-carousel-item">
            <InviteGameCard
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
    </div>
  )
}

function CompetitiveGamesListBody({
  rows,
  loading,
  error,
  isAdmin,
  userId,
  onRefresh,
  listTab,
  showListTabs = true,
}: CompetitiveProps) {
  const { t } = useTranslation()
  const [internalTab, setInternalTab] = useState<GamesListTab>('current')
  const didDefaultTab = useRef(false)

  const { currentRows, pastRows } = useMemo(() => splitCompetitionRows(rows), [rows])

  const tab = listTab ?? internalTab
  const genderFilter = useGamesGenderFilter()
  const visibleRows = tab === 'past' ? pastRows : currentRows
  const filteredRows = useMemo(() => {
    if (!genderFilter) return visibleRows
    return visibleRows.filter((row) => matchesGamesGenderFilter(row.gender, genderFilter))
  }, [visibleRows, genderFilter])

  useEffect(() => {
    if (!showListTabs || loading || didDefaultTab.current) return
    didDefaultTab.current = true
    if (currentRows.length === 0 && pastRows.length > 0) setInternalTab('past')
  }, [showListTabs, loading, currentRows.length, pastRows.length])

  const listClass = showListTabs ? 'space-y-3' : 'flex min-h-0 flex-1 flex-col'

  return (
    <div className={listClass}>
      {showListTabs ? (
        <ListTabs
          tab={tab}
          onTab={setInternalTab}
          currentCount={currentRows.length}
          pastCount={pastRows.length}
          t={t}
        />
      ) : null}

      {error && <p className="px-1 text-center text-xs text-red-600">{error}</p>}

      {loading ? (
        showListTabs ? (
          <p className="py-6 text-center text-xs text-brand-muted">{t('common.loading')}</p>
        ) : (
          <GamesHubLoading />
        )
      ) : filteredRows.length === 0 ? (
        showListTabs ? (
          <div className="game-card space-y-2 px-4 py-5 text-center">
            <p className="text-sm text-brand-text">
              {genderFilter
                ? t('competition.noGamesForGender', {
                    gender: genderFilterLabel(genderFilter, t),
                  })
                : tab === 'past'
                  ? t('competition.noPastGames')
                  : t('competition.noCurrentGames')}
            </p>
            {tab === 'current' && isAdmin ? (
              <>
                <Link to="/competitions/new" className="brand-btn px-6 py-2">
                  <IconAdd />
                  {t('competition.addCompetition')}
                </Link>
                <p className="text-xs text-brand-muted">{t('competition.tapPlusHint')}</p>
              </>
            ) : tab === 'current' ? (
              <p className="text-xs text-brand-muted">{t('competition.checkBackHint')}</p>
            ) : null}
          </div>
        ) : (
          <GamesHubEmpty>
            <p>
              {genderFilter
                ? t('competition.noGamesForGender', {
                    gender: genderFilterLabel(genderFilter, t),
                  })
                : tab === 'past'
                  ? t('competition.noPastGames')
                  : t('competition.noCurrentGames')}
            </p>
            {tab === 'current' && isAdmin ? (
              <>
                <Link to="/competitions/new" className="brand-btn px-6 py-2">
                  <IconAdd />
                  {t('competition.addCompetition')}
                </Link>
                <p className="text-xs text-brand-muted">{t('competition.tapPlusHint')}</p>
              </>
            ) : tab === 'current' ? (
              <p className="text-xs text-brand-muted">{t('competition.checkBackHint')}</p>
            ) : null}
          </GamesHubEmpty>
        )
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <InviteCardCarousel className="min-h-0 flex-1">
            {filteredRows.map((row) => (
              <li key={row.id} className="invite-card-carousel-item">
              <InviteGameCard
                kind="competition"
                row={row}
                isAdmin={isAdmin}
                userId={userId}
                onRefresh={onRefresh}
              />
            </li>
            ))}
          </InviteCardCarousel>
        </div>
      )}
    </div>
  )
}
