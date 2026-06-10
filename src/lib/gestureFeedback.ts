import type { Quadrant } from './gestureCapture'
import type { MatchTeam } from './types'
import { quadrantTeam } from './gestureScoring'
import type { TeamHalf } from './courtHalfCapture'
import { isMeshEnclosureZone, type EnclosureZoneId } from './padelCourtLayout'

export function gestureHapticStart(): void {
  navigator.vibrate?.(10)
}

export function gestureHapticQuadrantChange(): void {
  navigator.vibrate?.(6)
}

export function gestureHapticAnchor(): void {
  navigator.vibrate?.(8)
}

export function gestureHapticComplete(): void {
  navigator.vibrate?.([15, 35, 25])
}

/** Same ring/tint language as quadrant squares — glass + side mesh bands. */
export function glassBandHighlightClass(
  bandId: EnclosureZoneId,
  start: EnclosureZoneId | null,
  active: EnclosureZoneId | null,
  feedbackOn: boolean,
): string {
  if (!feedbackOn) return ''

  const mesh = isMeshEnclosureZone(bandId)

  if (bandId === start && bandId === active) {
    return mesh
      ? 'bg-white/25 ring-2 ring-inset ring-white/90 transition-colors duration-150'
      : '!shadow-[inset_0_0_0_2px_rgba(255,255,255,0.9),inset_0_0_0_9999px_rgba(255,255,255,0.25)] z-[3] transition-colors duration-150'
  }
  if (bandId === start) {
    return mesh
      ? 'bg-emerald-300/20 ring-2 ring-inset ring-emerald-200/80 transition-colors duration-150'
      : '!shadow-[inset_0_0_0_2px_rgba(167,243,208,0.8),inset_0_0_0_9999px_rgba(110,231,183,0.2)] z-[3] transition-colors duration-150'
  }
  if (bandId === active) {
    return mesh
      ? 'bg-amber-200/20 ring-2 ring-inset ring-amber-100/80 transition-colors duration-150'
      : '!shadow-[inset_0_0_0_2px_rgba(254,243,199,0.8),inset_0_0_0_9999px_rgba(251,191,36,0.2)] z-[3] transition-colors duration-150'
  }
  return ''
}

export function quadrantHighlightClass(
  label: Quadrant,
  start: Quadrant | null,
  active: Quadrant | null,
  isDrawing: boolean,
): string {
  if (!isDrawing) return 'bg-transparent'

  if (label === start && label === active) {
    return 'bg-white/25 ring-2 ring-inset ring-white/90'
  }
  if (label === start) return 'bg-emerald-300/20 ring-2 ring-inset ring-emerald-200/80'
  if (label === active) return 'bg-amber-200/20 ring-2 ring-inset ring-amber-100/80'
  return 'bg-black/5'
}

export function serveFeedbackQuadrantClass(
  label: Quadrant,
  server: Quadrant,
  receive: Quadrant,
  isDrawing: boolean,
  start: Quadrant | null,
  active: Quadrant | null,
): string {
  if (label === server) {
    return 'animate-pulse bg-emerald-200/40 ring-2 ring-inset ring-emerald-100/90 transition-colors duration-300'
  }
  if (label === receive) {
    return 'bg-amber-300/8 ring-1 ring-inset ring-amber-200/25 transition-colors duration-300'
  }
  if (isDrawing) return quadrantHighlightClass(label, start, active, true)
  return 'bg-black/5'
}

const LOSER_SIDE_CLASS =
  'bg-rose-400/28 ring-2 ring-inset ring-rose-200/70 transition-colors duration-300'

export function pointExchangeHighlightClass(
  label: Quadrant,
  winnerTeam: MatchTeam,
  loserTeam: MatchTeam,
  isDrawing: boolean,
  start: Quadrant | null,
  active: Quadrant | null,
): string {
  const onLoserTeam = quadrantTeam(label) === loserTeam
  const onWinnerTeam = quadrantTeam(label) === winnerTeam

  if (isDrawing && start && quadrantTeam(start) === loserTeam) {
    if (onLoserTeam && (label === start || label === active)) {
      return 'bg-rose-400/38 ring-2 ring-inset ring-white/85 transition-colors duration-300'
    }
    if (onLoserTeam) return LOSER_SIDE_CLASS
    return 'bg-black/5'
  }

  if (onLoserTeam) return LOSER_SIDE_CLASS
  if (onWinnerTeam) return 'bg-black/5'
  return 'bg-black/5'
}

/** Confirm-serve step: highlight serving team and the chosen first server. */
export function serveConfirmQuadrantClass(label: Quadrant, server: Quadrant): string {
  const servingTeam = quadrantTeam(server)
  const onServingTeam = quadrantTeam(label) === servingTeam
  if (label === server) {
    return 'animate-pulse bg-emerald-300/45 ring-2 ring-inset ring-emerald-100/95 transition-colors duration-300'
  }
  if (onServingTeam) {
    return 'bg-emerald-200/28 ring-2 ring-inset ring-emerald-100/70 transition-colors duration-300'
  }
  return 'bg-black/20 opacity-70'
}

export function teamHalfHighlightClass(half: TeamHalf, actorHalf: TeamHalf | null): string {
  if (!actorHalf) return 'bg-transparent'
  if (half === actorHalf) return 'bg-white/10 ring-2 ring-inset ring-amber-200/45'
  return 'bg-black/20'
}
