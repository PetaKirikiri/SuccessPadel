import { englishLoginCallback, englishTicketUrl, englishDestination, SHARED_LIFF_ID, type EnglishMode } from './englishEntry'

type LineSdk = {
  init: (config: { liffId: string; withLoginOnExternalBrowser: boolean }) => Promise<unknown>
  isLoggedIn: () => boolean
  getIDToken: () => string | null
  getAccessToken: () => string | null
  login: (config: { redirectUri: string }) => void
}
type Invoke = (name: string, body: Record<string, unknown>, signal: AbortSignal) => Promise<Record<string, unknown>>

// Dependency-injected so the real new/returning-user sequence can be exercised
// without creating test people in the shared production account database.
export async function englishHandshake(
  entry: { signup: boolean; attempted: boolean; mode?: EnglishMode },
  line: LineSdk,
  invoke: Invoke,
  timeoutMs = 20000,
  onStep: (step: string) => void = () => {},
): Promise<string | null> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const { signal } = controller
  const call: Invoke = async (name, body) => {
    signal.throwIfAborted()
    onStep(name === 'line-liff-auth' ? 'account-creation' : 'account-recognition')
    const data = await invoke(name, body, signal)
    signal.throwIfAborted()
    if (data.error) throw new Error('Could not connect your account. Please try again.')
    return data
  }
  const work = async () => {
    // Do not leave the registered endpoint before primary/secondary init finishes.
    onStep('line-initialization')
    await line.init({ liffId: SHARED_LIFF_ID, withLoginOnExternalBrowser: false })
    signal.throwIfAborted()
    if (!line.isLoggedIn()) {
      if (entry.attempted) throw new Error('LINE approval was not completed. Please try again.')
      onStep('line-approval')
      line.login({ redirectUri: englishLoginCallback(entry.signup, entry.mode) })
      return null
    }
    const token = line.getIDToken()
    if (!token) throw new Error('LINE did not share your identity. Please try again.')
    let result = await call('line-liff-recognize', { id_token: token, handoff: true }, signal)
    if (result.recognised === false) {
      if (!entry.signup) return `${englishDestination(entry.mode)}?line_result=new`
      // This is the existing Padel account service. It verifies LINE identity,
      // reuses matching accounts and obtains the name/photo from LINE.
      const registered = await call('line-liff-auth', { id_token: token, access_token: line.getAccessToken() }, signal)
      if (!registered.access_token || !registered.refresh_token) throw new Error('Account registration did not finish. Please try again.')
      result = await call('line-liff-recognize', { id_token: token, handoff: true }, signal)
    }
    if (result.recognised !== true || typeof result.ticket !== 'string' || !result.ticket) {
      throw new Error('Could not finish sign-in. Please try again.')
    }
    // Only a single-use ticket crosses origins, never LINE or session tokens.
    return englishTicketUrl(result.ticket, entry.mode)
  }
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('LINE took too long. Please try again.')) }, timeoutMs)
      }),
    ])
  } finally { clearTimeout(timer); controller.abort() }
}
