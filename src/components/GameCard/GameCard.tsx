import './gameCard.tv.css'
import type { ReactNode } from 'react'
import type { GameCardInputProps } from './types'
import type { GameCardSize } from '../../lib/viewBreakpoints'
import { useGameCardSize } from '../../hooks/useGameCardSize'
import { GameCardHeader } from './GameCardHeader'
import { GameCardCourts } from './GameCardCourts'
import { courtsBodyClass, cardFillsViewport, isTvSize } from './GameCard.styles'
import { useGameCardScoring } from './useGameCardScoring'
import { HorizontalPanelCarousel } from '../../shared/carousel/HorizontalPanelCarousel'

function gameCardClass({
  finished,
  size,
}: {
  finished: boolean
  size: GameCardSize
}) {
  const tv = isTvSize(size)
  const fills = cardFillsViewport(size)
  const parts = [
    'game-card-shell flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border-2 bg-brand-surface shadow-[0_10px_30px_-12px_rgba(96,45,36,0.35)] transition-colors dark:border-white/15 dark:bg-white/[0.07] dark:shadow-none',
  ]
  if (finished) {
    parts.push(
      'border-brand-border/55 bg-[#f4f3f1] shadow-[0_4px_14px_-10px_rgba(96,45,36,0.2)] dark:border-white/12 dark:bg-white/[0.04] dark:shadow-none',
    )
  } else {
    parts.push('border-brand-primary/40 dark:border-brand-accent/35')
  }
  if (tv) parts.push('tv-game-card flex min-h-0 flex-1 flex-col')
  else if (fills) parts.push('game-card-fill flex min-h-0 flex-1 flex-col')
  return parts.join(' ')
}

function GameCardRoot({
  gameNumber,
  finished,
  size,
  live,
  racetrackPaused = false,
  children,
}: {
  gameNumber: number
  finished: boolean
  size: GameCardSize
  live: boolean
  racetrackPaused?: boolean
  children: ReactNode
}) {
  const tv = isTvSize(size)
  const fills = cardFillsViewport(size)
  const cardClass = gameCardClass({ finished, size })

  if (live) {
    return (
      <div
        id={`game-${gameNumber}`}
        className={`game-card-racetrack rounded-2xl${
          racetrackPaused ? ' game-card-racetrack--paused' : ''
        }${tv || fills ? ' flex min-h-0 flex-1 flex-col' : ''}${tv ? ' tv-game-card-racetrack' : ''}`}
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

/**
 * The one game card. Responsive layout is driven by CSS via `html[data-viewport]`;
 * `size` here only feeds the few JS behaviours (TV carousel, court grid) that CSS can't do.
 */
export function GameCard(props: GameCardInputProps) {
  const detectedSize = useGameCardSize()
  const size = props.size ?? detectedSize
  const {
    game,
    session,
    displayTimeLabel,
    scoreUnit,
    finished,
    isLiveNow,
    isCurrentGame,
    countdown,
    countdownLabelText,
    systemTimeLabel,
    collapsed,
    onToggleCollapsed,
    currentUserId,
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
    onGestureGamesSynced,
    onCompetitionCourtGamesSaved,
    resolveCompetitionRoundId,
    onSaved,
    canEdit = false,
    tvNav,
    onBack,
    editHref,
    viewAlongUrl,
    leaderboardBody,
    activePanel = 'game',
    onActivePanel,
    courtStandings,
    roster,
    rosterNameById,
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

  const showLeaderboardCarousel = Boolean(leaderboardBody && onActivePanel && !isTvSize(size))
  const gestureScoreHref =
    gestureScoreEnabled && !finished && sessionId
      ? friendly
        ? `/friendly/${sessionId}/games/${game.gameNumber}/gesture-score`
        : competitionId
          ? `/competitions/${competitionId}/games/${game.gameNumber}/gesture-score`
          : undefined
      : undefined

  const header = (
    <GameCardHeader
      gameNumber={game.gameNumber}
      isLiveNow={isLiveNow}
      timeLabel={displayTimeLabel}
      countdown={countdown}
      countdownLabelText={countdownLabelText}
      systemTimeLabel={systemTimeLabel}
      finished={finished}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      size={size}
      tvNav={tvNav}
      onBack={onBack}
      editHref={editHref}
      viewAlongUrl={viewAlongUrl}
      gestureScoreHref={gestureScoreHref}
      onLeaderboardToggle={
        showLeaderboardCarousel && onActivePanel
          ? () => {
              if (activePanel !== 'leaderboard' && document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              onActivePanel(activePanel === 'leaderboard' ? 'game' : 'leaderboard')
            }
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
        onGestureGamesSynced={onGestureGamesSynced}
        onCompetitionCourtGamesSaved={onCompetitionCourtGamesSaved}
        resolveCompetitionRoundId={resolveCompetitionRoundId}
        courtStandings={courtStandings}
        roster={roster}
        rosterNameById={rosterNameById}
        t={t}
      />
    </div>
  ) : null

  const showRacetrack = isCurrentGame && !finished

  return (
    <GameCardRoot
      gameNumber={game.gameNumber}
      finished={finished}
      size={size}
      live={showRacetrack}
      racetrackPaused={activePanel === 'leaderboard'}
    >
      {showLeaderboardCarousel && onActivePanel ? (
        <HorizontalPanelCarousel
          activeIndex={activePanel === 'leaderboard' ? 1 : 0}
          onIndexChange={(index) => {
            if (index === 1 && document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
            }
            onActivePanel(index === 0 ? 'game' : 'leaderboard')
          }}
          getPanelHeader={(index) =>
            index === 1 ? (
              <div className="flex shrink-0 items-center justify-start border-b border-brand-border/60 bg-brand-surface px-3 py-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActivePanel('game')
                  }}
                  aria-label={t('aria.back')}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg font-medium leading-none shadow-sm transition active:scale-95 ${
                    finished
                      ? 'border-brand-border/60 bg-brand-bg-alt text-brand-primary'
                      : 'border-white/25 bg-white/10 text-brand-bg-alt dark:border-white/15 dark:text-brand-accent-light'
                  }`}
                >
                  ←
                </button>
              </div>
            ) : null
          }
          panelClassName={(index) =>
            index === 0 ? 'flex min-h-0 flex-col' : 'flex min-h-0 flex-col overflow-hidden'
          }
        >
          <>
            {header}
            {courts}
          </>
          <div className="game-card-panel-carousel-scroll min-h-0 flex-1 overflow-y-auto">
            {leaderboardBody}
          </div>
        </HorizontalPanelCarousel>
      ) : (
        <>
          {header}
          {courts}
        </>
      )}
    </GameCardRoot>
  )
}
