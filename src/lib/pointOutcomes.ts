import type { BallPathOutcome, BallPathResult } from './ballPathScoring'
import type { ServeLanding } from './serveGesture'

/** Central registry for rally + serve outcome labels and foul semantics. */
export type PointOutcomeKind = 'serve' | BallPathOutcome

export type PointOutcomeDef = {
  kind: PointOutcomeKind
  labelKey: string
  descriptionKey: string
  foul: boolean
}

export const BALL_PATH_OUTCOME_DEFS: Record<BallPathOutcome, PointOutcomeDef> = {
  score: {
    kind: 'score',
    labelKey: 'practice.outcome.score',
    descriptionKey: 'practice.outcome.scoreDesc',
    foul: false,
  },
  out: {
    kind: 'out',
    labelKey: 'practice.outcome.out',
    descriptionKey: 'practice.outcome.outDesc',
    foul: true,
  },
  net: {
    kind: 'net',
    labelKey: 'practice.outcome.net',
    descriptionKey: 'practice.outcome.netDesc',
    foul: true,
  },
  glass: {
    kind: 'glass',
    labelKey: 'practice.outcome.glass',
    descriptionKey: 'practice.outcome.glassDesc',
    foul: false,
  },
}

export const SERVE_LANDING_DEFS: Record<ServeLanding, PointOutcomeDef> = {
  in: {
    kind: 'serve',
    labelKey: 'practice.outcome.serveIn',
    descriptionKey: 'practice.outcome.serveInDesc',
    foul: false,
  },
  net: {
    kind: 'serve',
    labelKey: 'practice.outcome.serveNet',
    descriptionKey: 'practice.outcome.serveNetDesc',
    foul: true,
  },
  out: {
    kind: 'serve',
    labelKey: 'practice.outcome.serveOut',
    descriptionKey: 'practice.outcome.serveOutDesc',
    foul: true,
  },
}

export function outcomeFromBallPath(result: BallPathResult): PointOutcomeDef {
  return BALL_PATH_OUTCOME_DEFS[result.outcome]
}

export function outcomeFromServeLanding(landing: ServeLanding): PointOutcomeDef {
  return SERVE_LANDING_DEFS[landing]
}

/** All rally outcomes in display order for the practice legend. */
export const PRACTICE_RALLY_OUTCOMES: BallPathOutcome[] = ['score', 'out', 'net', 'glass']

/** Serve outcomes in display order. */
export const PRACTICE_SERVE_OUTCOMES: ServeLanding[] = ['in', 'net', 'out']
