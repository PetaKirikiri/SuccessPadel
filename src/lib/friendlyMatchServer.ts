import type { GestureDebugEntry } from './gestureDebugLog'
import type { MatchSessionRecord } from './matchSessionLog'
import type { QuadrantPlayers } from './gesturePadPlayers'
import { buildGameLogPayload, upsertMatchGestureLog } from './matchLogServer'

export { parseFriendlyCourtSetupKey } from './matchLogServer'

/** @deprecated use upsertMatchGestureLog via matchLogServer */
export async function saveFriendlyMatchLog(
  courtSetupKey: string,
  session: MatchSessionRecord,
  gestures: GestureDebugEntry[],
  roster: QuadrantPlayers | null = null,
): Promise<{ error: string | null }> {
  const payload = buildGameLogPayload(courtSetupKey, session, gestures, roster, {
    isFriendly: true,
    competitionId: session.competitionId,
    gameNumber: session.gameNumber,
    courtId: session.courtId,
  })
  return upsertMatchGestureLog(payload)
}
