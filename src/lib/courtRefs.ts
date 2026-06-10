export type CourtRef = {
  profileId: string
  displayName: string
  avatarUrl: string | null
}

export type SetupCourtRow = {
  name: string
  sort_order: number
  ref?: CourtRef | null
}

export type CourtRefsLookup = {
  byName: Map<string, CourtRef>
  byIndex: (CourtRef | undefined)[]
}

function normalizeRef(raw: unknown): CourtRef | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const profileId = String(r.profileId ?? r.profile_id ?? '').trim()
  if (!profileId) return null
  return {
    profileId,
    displayName: String(r.displayName ?? r.display_name ?? '').trim(),
    avatarUrl: (r.avatarUrl ?? r.avatar_url ?? null) as string | null,
  }
}

function normalizeRow(raw: unknown): SetupCourtRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = String(r.name ?? '').trim()
  if (!name) return null
  return {
    name,
    sort_order: Number(r.sort_order ?? 0),
    ref: normalizeRef(r.ref),
  }
}

export function parseSetupCourtsRpc(data: unknown): SetupCourtRow[] {
  let raw = data
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeRow).filter((row): row is SetupCourtRow => row != null)
}

export function buildCourtRefsLookup(rows: SetupCourtRow[]): CourtRefsLookup {
  const byName = new Map<string, CourtRef>()
  const byIndex: (CourtRef | undefined)[] = []
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order)
  for (const row of sorted) {
    const ref = row.ref?.profileId ? row.ref : undefined
    byIndex.push(ref)
    if (ref) {
      byName.set(row.name, ref)
      byName.set(`Court ${row.sort_order}`, ref)
    }
  }
  return { byName, byIndex }
}

export const emptyCourtRefsLookup = (): CourtRefsLookup => ({
  byName: new Map(),
  byIndex: [],
})

export function resolveCourtRef(
  courtLabel: string,
  courtIndex: number,
  lookup?: CourtRefsLookup,
): CourtRef | undefined {
  if (!lookup) return undefined
  const direct = lookup.byName.get(courtLabel)
  if (direct) return direct
  const numbered = courtLabel.match(/^Court\s*(\d+)$/i)
  if (numbered) {
    const byNumber = lookup.byName.get(`Court ${numbered[1]}`)
    if (byNumber) return byNumber
    const byIdx = lookup.byIndex[Number(numbered[1]) - 1]
    if (byIdx) return byIdx
  }
  return lookup.byIndex[courtIndex]
}

/** @deprecated use buildCourtRefsLookup */
export function courtRefsByName(rows: SetupCourtRow[]): Map<string, CourtRef> {
  return buildCourtRefsLookup(rows).byName
}
