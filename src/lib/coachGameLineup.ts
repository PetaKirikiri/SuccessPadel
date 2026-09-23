import type { CompetitionRound, ClubCourt } from '../hooks/useCompetitionRun'

export type CoachPlayer = {
  id: string
  playerId: string | null
  profileId: string | null
  name: string
  avatarUrl: string | null
}
export type CoachCourt = { id: string; name: string; a: CoachPlayer[]; b: CoachPlayer[] }

/** Only persisted assignments determine teams; never infer pairs from roster order. */
export function coachGameLineup(round: CompetitionRound | undefined, roster: CoachPlayer[], courts: ClubCourt[]) {
  const assigned = new Set<string>()
  const grouped = new Map<string, CoachCourt>()
  for (const slot of round?.competition_round_players ?? []) {
    const exact = roster.find(player => player.id === slot.roster_entry_id)
    const candidates = exact ? [exact] : roster.filter(player =>
      (slot.padel_player_id && player.playerId === slot.padel_player_id) ||
      (slot.profile_id && player.profileId === slot.profile_id))
    const player = candidates.length === 1 ? candidates[0] : null
    if (!player || assigned.has(player.id) || !slot.court_id || !['a', 'b'].includes(slot.team)) continue
    const court = grouped.get(slot.court_id) ?? {
      id: slot.court_id,
      name: courts.find(c => c.id === slot.court_id)?.name ?? slot.courts?.name ?? 'Court',
      a: [], b: [],
    }
    court[slot.team].push(player)
    grouped.set(court.id, court)
    assigned.add(player.id)
  }
  const order = new Map(courts.map(court => [court.id, court.sort_order]))
  return {
    courts: [...grouped.values()].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999) || a.name.localeCompare(b.name, undefined, { numeric: true })),
    unassigned: roster.filter(player => !assigned.has(player.id)),
  }
}

export function initialCoachRound(rounds: CompetitionRound[], requested: number | null, now = Date.now()): string | null {
  const ordered = [...rounds].sort((a, b) => a.round_number - b.round_number)
  return (ordered.find(round => round.round_number === requested) ??
    ordered.find(round => Date.parse(round.starts_at) <= now && Date.parse(round.ends_at) > now) ??
    ordered.find(round => Date.parse(round.starts_at) > now) ??
    ordered.at(-1))?.id ?? null
}

export function coachCompetitionFromPath(path: string | null | undefined): string | null {
  if (!path?.startsWith('/') || path.startsWith('//')) return null
  const url = new URL(path, 'https://successpadel.app')
  const id = url.searchParams.get('competition') ?? url.pathname.match(/^\/competitions\/([^/]+)/)?.[1]
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null
}
