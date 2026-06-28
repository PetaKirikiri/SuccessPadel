import type { CSSProperties, ReactNode } from 'react'
import type { TranslateFn } from '../../i18n'
import type { CourtPlayer } from '../../lib/americanoSchedule'
import type { AmericanoScoringUnit } from '../../lib/competitionPresets'
import type { CourtScoreSubmit } from '../../lib/competitionScoreInput'
import type { FriendlyCourtScoreSubmit } from '../../lib/friendlyManualScore'
import { pivotScheduleByGame } from '../../lib/competitionCourtBoard'
import type { LiveCourtGamesScore, LiveCourtPointFeed } from '../../lib/liveCourtScore'
import type { MatchTeam } from '../../lib/types'
import type { GameCardSize } from '../../lib/viewBreakpoints'
import type { TvGameNav } from '../play/TvGameCarousel'
import type { LiveCourt } from './gameBoardTypes'

export type ScoringGame = ReturnType<typeof pivotScheduleByGame>[number]

export type MatchForCourt = (
  roundId: string,
  courtId: string,
) => {
  score_summary?: string
  teamAPoints?: number
  teamBPoints?: number
  winner?: MatchTeam
  playedAt?: string
} | undefined

export type DuoTeamLabels = (
  teamA: [string, string],
  teamB: [string, string],
  teamAPlayers?: CourtPlayer[],
  teamBPlayers?: CourtPlayer[],
) => { teamALabel?: string; teamBLabel?: string }

export type GameCardCompetitionSession = {
  kind: 'competition'
  competitionId?: string
  sessionId?: string
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt?: MatchForCourt
  onSubmitScores?: (entries: CourtScoreSubmit[]) => Promise<void>
  scoringEnabled: boolean
}

export type GameCardFriendlySession = {
  kind: 'friendly'
  sessionId: string
  onSubmitScores?: (entries: FriendlyCourtScoreSubmit[]) => Promise<void>
  scoreSubmitEnabled?: boolean
  scoringEnabled: boolean
}

export type GameCardPreviewSession = {
  kind: 'preview'
  sessionId?: string
  competitionId?: string
  gameRoundId?: string
  courtsForGame: LiveCourt[]
  courtIdByLabel?: Map<string, string>
  matchForCourt?: MatchForCourt
  scoringEnabled: false
}

export type GameCardSession =
  | GameCardCompetitionSession
  | GameCardFriendlySession
  | GameCardPreviewSession

export type GameCardPanel = 'game' | 'leaderboard'

export type GameCardProps = {
  game: ScoringGame
  session: GameCardSession
  size: GameCardSize
  displayTimeLabel: string
  scoreUnit: AmericanoScoringUnit
  finished: boolean
  isLiveNow: boolean
  isCurrentGame: boolean
  countdown?: string | null
  countdownLabelText: string
  collapsed: boolean
  onToggleCollapsed: () => void
  currentUserId?: string | null
  currentUserDisplayName?: string | null
  currentUserAvatarUrl?: string | null
  liveCourtEnabled?: boolean
  gestureScoreEnabled?: boolean
  manualScoreEnabled?: boolean
  friendly?: boolean
  duoTeamLabels?: DuoTeamLabels
  courtScoreMax?: number
  courtPlayTo?: number
  liveCourtScores?: Map<string, LiveCourtGamesScore>
  liveCourtFeeds?: Map<string, LiveCourtPointFeed>
  onSaved?: () => void | Promise<void>
  canEdit?: boolean
  tvNav?: TvGameNav
  onBack?: () => void
  viewAlongUrl?: string | null
  leaderboardBody?: ReactNode
  activePanel?: GameCardPanel
  onActivePanel?: (panel: GameCardPanel) => void
  t: TranslateFn
}

export type GameCardCourtRow = {
  courtKey: string
  courtId?: string
  courtLabel: string
  court: ScoringGame['courts'][number]
  teamAStr: string
  teamBStr: string
  canSubmit: boolean
}

export type CourtsGridProps = { className: string; style?: CSSProperties }

/** Props for the public GameCard facade (size optional — detected from viewport). */
export type GameCardInputProps = Omit<GameCardProps, 'size'> & { size?: GameCardSize }
