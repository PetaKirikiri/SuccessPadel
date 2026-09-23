/** Passive recognition is deliberately separate from interactive login/signup. */
export type RecognitionTokens = { access_token: string; refresh_token: string }
export type RecognitionResult = 'recognised' | 'guest' | 'timeout'

export type RecognitionSteps = {
  init: () => Promise<void>
  token: () => Promise<string | null>
  exchange: (token: string, signal: AbortSignal) => Promise<RecognitionTokens | null>
  apply: (tokens: RecognitionTokens, signal: AbortSignal) => Promise<void>
  mayContinue: () => boolean
}

/** A timeout also fences off late promises: they cannot start another step. */
export async function recogniseLineAccount(
  steps: RecognitionSteps,
  timeoutMs = 12_000,
): Promise<RecognitionResult> {
  const controller = new AbortController()
  const canContinue = () => !controller.signal.aborted && steps.mayContinue()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<RecognitionResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve('timeout')
    }, timeoutMs)
  })
  const work = async (): Promise<RecognitionResult> => {
    if (!canContinue()) return 'guest'
    await steps.init()
    if (!canContinue()) return 'guest'
    const token = await steps.token()
    if (!token || !canContinue()) return 'guest'
    const tokens = await steps.exchange(token, controller.signal)
    if (!tokens || !canContinue()) return 'guest'
    await steps.apply(tokens, controller.signal)
    return 'recognised'
  }
  try {
    return await Promise.race([work().catch(() => 'guest' as const), timeout])
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}

const ENTRY_MARKER = 'sp_line_attempt'
const ENTRY_STORAGE_KEY = 'sp-line-passive-entry'

/** One handoff per tab, plus a URL marker that survives a different LIFF origin. */
export function passiveLineEntryPath(
  href: string,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): string | null {
  const url = new URL(href)
  if (url.searchParams.has(ENTRY_MARKER)) return null
  if ([...url.searchParams.keys()].some(key => key.startsWith('liff.'))) return null
  try {
    if (storage.getItem(ENTRY_STORAGE_KEY)) return null
    storage.setItem(ENTRY_STORAGE_KEY, '1')
    if (storage.getItem(ENTRY_STORAGE_KEY) !== '1') return null
  } catch {
    return null
  }
  url.searchParams.set(ENTRY_MARKER, '1')
  return `${url.pathname}${url.search}${url.hash}`
}

/** A stale referrer alone must never redirect Safari or WhatsApp into LINE. */
export function isLineEntryBrowser(userAgent: string, inClient: boolean): boolean {
  return inClient || /\bLine\//i.test(userAgent)
}
