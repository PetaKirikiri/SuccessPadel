import { CLOTHING_SLOT_IDENTITIES } from './clothingLearning'
import { HOUSEHOLD_SLOT_IDENTITIES } from './householdLearning'
import type { TeamLearningIdentity } from './spiritAnimals'

const slotIdentities: ReadonlyMap<string, TeamLearningIdentity> = new Map(
  [...HOUSEHOLD_SLOT_IDENTITIES, ...CLOTHING_SLOT_IDENTITIES].map(identity => [identity.rosterId, identity]),
)

/** Event-owned session_players IDs; never names, profiles, rank or current partner. */
export function learningIdentityForSlot(rosterId: string | null | undefined): TeamLearningIdentity | null {
  return rosterId ? slotIdentities.get(rosterId) ?? null : null
}
