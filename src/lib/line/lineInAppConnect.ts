import { peekClaimPadelPlayer, saveClaimPadelPlayer } from '../authClaimPlayer'
import { claimPadelPlayer, claimPendingPadelPlayer } from '../claimPadelPlayer'
import { runLoginWithAPP, shouldRunLineHandshake } from '../auth/LoginWithAPP'
import { supabase } from '../supabaseClient'
import { linkPadelPlayerInLineApp } from './playerLink'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function playerIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/players\/([^/]+)/)
  const id = match?.[1]
  return id && UUID_RE.test(id) ? id : null
}

async function linkablePadelPlayerId(playerId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('ensure_linkable_padel_player', {
    p_player_id: playerId,
  })
  if (error || !data) return null
  return data as string
}

export type LineInAppConnectResult = {
  ok: boolean
  redirected: boolean
  error: string | null
  linking: boolean
}

export async function runLineInAppConnect(
  pathname: string,
  search: string,
  isAuthenticated: boolean,
): Promise<LineInAppConnectResult> {
  if (!(await shouldRunLineHandshake())) {
    return { ok: true, redirected: false, error: null, linking: false }
  }

  const competitionParam = new URLSearchParams(search).get('competition')
  const competitionId =
    competitionParam && UUID_RE.test(competitionParam) ? competitionParam : null
  const profilePlayerId = playerIdFromPath(pathname)

  if (isAuthenticated) {
    const pending = peekClaimPadelPlayer()
    if (pending) {
      const claimErr = await claimPendingPadelPlayer()
      if (claimErr && !/already linked/i.test(claimErr)) {
        return { ok: false, redirected: false, error: claimErr, linking: true }
      }
      return { ok: true, redirected: false, error: null, linking: Boolean(pending) }
    }

    if (profilePlayerId) {
      const linkable = await linkablePadelPlayerId(profilePlayerId)
      if (linkable) {
        const claimErr = await claimPadelPlayer(linkable)
        if (claimErr && !/already linked/i.test(claimErr)) {
          return { ok: false, redirected: false, error: claimErr, linking: true }
        }
        return { ok: true, redirected: false, error: null, linking: true }
      }
    }

    return { ok: true, redirected: false, error: null, linking: false }
  }

  if (profilePlayerId) {
    const linkable = await linkablePadelPlayerId(profilePlayerId)
    if (linkable) {
      saveClaimPadelPlayer(linkable)
      const result = await linkPadelPlayerInLineApp(linkable, competitionId)
      if (result.redirected) {
        return { ok: false, redirected: true, error: null, linking: true }
      }
      return {
        ok: !result.error,
        redirected: false,
        error: result.error ?? null,
        linking: true,
      }
    }
  }

  const { error, redirected, inClient } = await runLoginWithAPP()
  if (redirected) {
    return { ok: false, redirected: true, error: null, linking: false }
  }
  if (!inClient) {
    return { ok: true, redirected: false, error: null, linking: false }
  }
  return { ok: !error, redirected: false, error, linking: false }
}
