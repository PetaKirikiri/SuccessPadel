import type { ReactNode } from 'react'
import type { GameCardProps } from './types'
import type { GameCardSize } from '../../lib/viewBreakpoints'
import { GameCardHeader } from './GameCardHeader'
import { GameCardCourts } from './GameCardCourts'
import { GameCardPanelCarousel } from './GameCardPanelCarousel'
import { courtsBodyClass, cardFillsViewport, isTvSize } from './gameCardSizes'
import { useGameCardScoring } from './useGameCardScoring'

function gameCardClass({
  finished,
  isMyGame = false,
  size,
}: {
  finished: boolean
  isMyGame?: boolean
  size: GameCardSize
}) {
  const tv = isTvSize(size)
  const fills = cardFillsViewport(size)
  const parts = [
    'flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border-2 bg-brand-surface shadow-[0_10px_30px_-12px_rgba(96,45,36,0.35)] transition-colors dark:border-white/15 dark:bg-white/[0.07] dark:shadow-none',
  ]
  if (finished) {
    parts.push(
      'border-brand-border/55 bg-[#f4f3f1] shadow-[0_4px_14px_-10px_rgba(96,45,36,0.2)] dark:border-white/12 dark:bg-white/[0.04] dark:shadow-none',
    )
  } else {
    parts.push('border-brand-primary/40 dark:border-brand-accent/35')
  }
  if (isMyGame && !finished) {
    parts.push('ring-2 ring-brand-accent/70 dark:ring-brand-accent/50')
  }
  if (tv) parts.push('tv-game-card flex min-h-0 flex-1 flex-col')
  else if (fills) parts.push('game-card-fill flex min-h-0 flex-1 flex-col')
  return parts.join(' ')
}

function GameCardRoot({
  gameNumber,
  finished,
  isCurrentGame,
  isMyGame,
  size,
  children,
}: {
  gameNumber: number
  finished: boolean
  isCurrentGame: boolean
  isMyGame: boolean
  size: GameCardSize
  children: ReactNode
}) {
  const tv = isTvSize(size)
  const fills = cardFillsViewport(size)
  const cardClass = gameCardClass({ finished, isMyGame, size })
  const live = isCurrentGame && !finished

  if (live) {
    return (
      <div
        id={`game-${gameNumber}`}
        className={`game-card-racetrack rounded-2xl${
          tv || fills ? ' flex min-h-0 flex-1 flex-col' : ''
        }${tv ? ' tv-game-card-racetrack' : ''}`}
      >
        <div className={`${cardClass} !rounded-[14px]${tv || fills ? ' min-h-0 flex-1' : ''}`}>{children}</div>
      </div>
    )
  }

  return (
    <div id={`game-${gameNumber}`} className={cardClass}>
      {children}
    </div>
  )
}

/** Shared game card body — size-specific wrappers pass a fixed `size`. */
export function GameCardView(props: GameCardProps) {
  const {
    game,
    session,
    size,
    displayTimeLabel,
    scoreUnit,
    finished,
    isLiveNow,
    isCurrentGame,
    countdown,
    countdownLabelText,
    collapsed,
    onToggleCollapsed,
    currentUserId,
    currentUserDisplayName,
    currentUserAvatarUrl,
    liveCourtEnabled = false,
    gestureScoreEnabled = false,
    manualScoreEnabled = false,
    friendly = false,
    duoTeamLabels,
    courtScoreMax,
    courtPlayTo,
    liveCourtScores,
    liveCourtFeeds,
    onSaved,
    canEdit = false,
    tvNav,
    onBack,
    viewAlongUrl,
    leaderboardBody,
    activePanel = 'game',
    onActivePanel,
    t,
  } = props

  const courtsForGame =
    session.kind === 'competition' || session.kind === 'preview'
      ? session.courtsForGame
      : []
  const courtIdByLabel =
    session.kind === 'competition' || session.kind === 'preview'
      ? session.courtIdByLabel
      : undefined
  const gameRoundId =
    session.kind === 'competition'
      ? session.gameRoundId
      : session.kind === 'preview'
        ? session.gameRoundId
        : undefined
  const matchForCourt =
    session.kind === 'competition'
      ? session.matchForCourt
      : session.kind === 'preview'
        ? session.matchForCourt
        : undefined
  const sessionId =
    session.kind === 'friendly'
      ? session.sessionId
      : session.kind === 'competition'
        ? session.sessionId
        : session.sessionId
  const competitionId =
    session.kind === 'competition'
      ? session.competitionId
      : session.kind === 'preview'
        ? session.competitionId
        : undefined

  const scoring = useGameCardScoring({
    game,
    session,
    courtsForGame,
    courtIdByLabel,
    gameRoundId,
    liveCourtScores,
    canEdit,
    courtPlayTo,
    onSaved,
    t,
  })

  const isMyGame = Boolean(
    currentUserId &&
      courtsForGame.some(
        (court) =>
          court.teamAPlayers?.some((player) => player.id === currentUserId) ||
          court.teamBPlayers?.some((player) => player.id === currentUserId) ||
          court.playerIds.includes(currentUserId),
      ),
  )

  const showLeaderboardCarousel = Boolean(leaderboardBody && onActivePanel && !isTvSize(size))

  const header = (
    <GameCardHeader
      gameNumber={game.gameNumber}
      isLiveNow={isLiveNow}
      timeLabel={displayTimeLabel}
      countdown={countdown}
      countdownLabelText={countdownLabelText}
      finished={finished}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      size={size}
      tvNav={tvNav}
      onBack={onBack}
      viewAlongUrl={viewAlongUrl}
      onLeaderboardToggle={
        showLeaderboardCarousel && onActivePanel
          ? () => onActivePanel(activePanel === 'leaderboard' ? 'game' : 'leaderboard')
          : undefined
      }
      leaderboardActive={activePanel === 'leaderboard'}
      t={t}
    />
  )

  const courts = !collapsed ? (
    <div className={courtsBodyClass(size, finished)}>
      <GameCardCourts
        game={game}
        size={size}
        scoreUnit={scoreUnit}
        courtScoreRows={scoring.courtScoreRows}
        courtsForGame={courtsForGame}
        courtIdByLabel={courtIdByLabel}
        gameRoundId={gameRoundId}
        matchForCourt={matchForCourt}
        setDraft={scoring.setDraft}
        submitCourt={scoring.hasScoring ? scoring.submitCourt : undefined}
        busyCourtKey={scoring.busyCourtKey}
        courtError={scoring.error}
        canEdit={scoring.canEdit}
        canSubmitScores={scoring.canSubmitScores}
        hasScoring={scoring.hasScoring}
        finished={finished}
        currentUserId={currentUserId}
        currentUserDisplayName={currentUserDisplayName}
        currentUserAvatarUrl={currentUserAvatarUrl}
        liveCourtEnabled={liveCourtEnabled}
        gestureScoreEnabled={gestureScoreEnabled}
        manualScoreEnabled={manualScoreEnabled}
        friendly={friendly}
        competitionId={competitionId}
        sessionId={sessionId}
        duoTeamLabels={duoTeamLabels}
        courtScoreMax={courtScoreMax}
        liveCourtScores={liveCourtScores}
        liveCourtFeeds={liveCourtFeeds}
        t={t}
      />
    </div>
  ) : null

  return (
    <GameCardRoot
      gameNumber={game.gameNumber}
      finished={finished}
      isCurrentGame={isCurrentGame}
      isMyGame={isMyGame}
      size={size}
    >
      {showLeaderboardCarousel && onActivePanel ? (
        <GameCardPanelCarousel
          activePanel={activePanel}
          onActivePanel={onActivePanel}
          gamePanel={
            <>
              {header}
              {courts}
            </>
          }
          leaderboardPanel={leaderboardBody}
        />
      ) : (
        <>
          {header}
          {courts}
        </>
      )}
    </GameCardRoot>
  )
}
