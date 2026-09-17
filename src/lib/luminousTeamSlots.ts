import type { TeamLearningIdentity } from './spiritAnimals'

export const LUMINOUS_COMPETITION_ID = 'c446edaf-3437-4084-ada8-e1008df8296f'
export const LUMINOUS_TEAM_IDENTITIES: readonly TeamLearningIdentity[] =
  [
    ['Bear', 'หมี', 'mee'],
    ['Tiger', 'เสือ', 'suea'],
    ['Lion', 'สิงโต', 'sing-toh'],
    ['Shark', 'ฉลาม', 'cha-laam'],
    ['Cobra', 'งูเห่า', 'ngoo hao'],
    ['Eagle', 'นกอินทรี', 'nok in-see'],
    ['Rhino', 'แรด', 'raet'],
    ['Wolf', 'หมาป่า', 'maa paa'],
  ].map(([english, thai, phonetic]) => ({
    imageUrl: `/spirit-animals/luminous/${english.toLowerCase()}.png`,
    english, thai, phonetic,
  }))

type SlotRow = { id: string; rank_order: number | null; profile_id?: string | null; padel_player_id?: string | null }

/** Current saved positions own the icon. Names, results and array order never do. */
export function luminousIdentityForTeam(sessionId: string | null | undefined, roster: readonly SlotRow[], ids: readonly (string | null | undefined)[]): TeamLearningIdentity | null {
  if (sessionId !== LUMINOUS_COMPETITION_ID) return null
  const rosterMatches = roster.filter(row => ids.includes(row.id))
  const matches = rosterMatches.length ? rosterMatches : roster.filter(row =>
    Boolean(row.profile_id && ids.includes(row.profile_id)) || Boolean(row.padel_player_id && ids.includes(row.padel_player_id)))
  if (!matches.length || matches.some(row => row.rank_order === null || !Number.isInteger(row.rank_order) || row.rank_order < 0)) return null
  const slots = new Set(matches.map(row => Math.floor(row.rank_order! / 2)))
  if (slots.size !== 1) return null
  return LUMINOUS_TEAM_IDENTITIES[[...slots][0]] ?? null
}
