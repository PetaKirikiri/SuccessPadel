import { loginWithAppDebugLog } from '../debug/loginWithAppDebug'
import { readLineProfilePatch, type LineProfilePatch } from './profileSync'
import {
  getDecodedLineClaims,
  getLineAccessToken,
  getLineIdToken,
  hasLiffId,
  initLiff,
  isInLineClient,
  isLineLoggedIn,
} from './liff'

export type LineClientStatus = {
  inClient: boolean
  lineLoggedIn: boolean
  profile: LineProfilePatch | null
  lineUserId: string | null
  hasAccessToken: boolean
  hasIdToken: boolean
  error: string | null
}

const emptyStatus = (): LineClientStatus => ({
  inClient: false,
  lineLoggedIn: false,
  profile: null,
  lineUserId: null,
  hasAccessToken: false,
  hasIdToken: false,
  error: null,
})

/** Read LINE name/photo from the in-app LIFF session — works before Supabase login. */
export async function probeLineClientProfile(log = false): Promise<LineClientStatus> {
  if (!hasLiffId()) return { ...emptyStatus(), error: 'LIFF not configured' }

  try {
    await initLiff()
    const inClient = isInLineClient()
    const lineLoggedIn = isLineLoggedIn()
    const decoded = getDecodedLineClaims()
    const lineUserId = decoded?.sub ?? null
    let profile: LineProfilePatch | null = null
    let hasAccessToken = false
    let hasIdToken = false
    let error: string | null = null

    if (lineLoggedIn) {
      hasIdToken = !!(await getLineIdToken())
      hasAccessToken = !!(await getLineAccessToken())
      profile = await readLineProfilePatch()
      if (!profile?.display_name) {
        error = lineUserId ? 'LINE authorized — name not returned yet' : 'LINE authorized — profile empty'
      }
    } else if (inClient) {
      error = 'Inside LINE — LIFF session not active yet'
    }

    const status: LineClientStatus = {
      inClient,
      lineLoggedIn,
      profile,
      lineUserId,
      hasAccessToken,
      hasIdToken,
      error,
    }

    if (log) {
      loginWithAppDebugLog('line/clientProfile.ts:probe', 'LINE client probe', 'H-LINE-PROFILE', {
        inClient,
        lineLoggedIn,
        displayName: profile?.display_name ?? null,
        pictureUrl: profile?.picture_url ? 'yes' : 'no',
        lineUserId,
        hasAccessToken,
        hasIdToken,
        error,
      })
    }

    return status
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'LIFF probe failed'
    if (log) {
      loginWithAppDebugLog('line/clientProfile.ts:probe', 'LINE probe error', 'H-LINE-PROFILE', {
        error: msg,
      })
    }
    return { ...emptyStatus(), error: msg }
  }
}
