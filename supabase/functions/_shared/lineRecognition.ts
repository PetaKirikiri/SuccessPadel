type Tokens = { access_token: string; refresh_token: string }
type Credential = Tokens | { ticket: string }
type RecognitionDependencies = {
  verify: (idToken: string) => Promise<string | null>
  findProfile: (lineId: string) => Promise<string | null>
  issueSession: (profileId: string) => Promise<Credential | null>
}

/** Verified LINE identity only. No name matching, signup, linking or role changes. */
export async function recogniseExistingLineMember(idToken: unknown, deps: RecognitionDependencies) {
  if (typeof idToken !== 'string' || !idToken || idToken.length > 16_384) {
    return { recognised: false as const }
  }
  const lineId = await deps.verify(idToken)
  if (!lineId || !/^[Uu][0-9a-f]{32}$/i.test(lineId)) return { recognised: false as const }
  const profileId = await deps.findProfile(`U${lineId.slice(1).toLowerCase()}`)
  if (!profileId) return { recognised: false as const }
  const tokens = await deps.issueSession(profileId)
  if (!tokens) return { recognised: false as const }
  return { recognised: true as const, ...tokens }
}
