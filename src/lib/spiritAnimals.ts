export type TeamLearningIdentity = {
  imageUrl: string
  thai: string
  phonetic: string
  english: string
}

export const TEAM_KITCHEN_IDENTITIES = [
  { imageUrl: '/kitchen-learning/spoon.png', thai: 'ช้อน', phonetic: 'chawn', english: 'Spoon' },
  { imageUrl: '/kitchen-learning/fork.png', thai: 'ส้อม', phonetic: 'sawm', english: 'Fork' },
  { imageUrl: '/kitchen-learning/knife.png', thai: 'มีด', phonetic: 'meet', english: 'Knife' },
  { imageUrl: '/kitchen-learning/plate.png', thai: 'จาน', phonetic: 'jaan', english: 'Plate' },
  { imageUrl: '/kitchen-learning/bowl.png', thai: 'ชาม', phonetic: 'chaam', english: 'Bowl' },
  { imageUrl: '/kitchen-learning/frying-pan.png', thai: 'กระทะ', phonetic: 'gra-ta', english: 'Frying pan' },
  { imageUrl: '/kitchen-learning/pot.png', thai: 'หม้อ', phonetic: 'maw', english: 'Pot' },
  { imageUrl: '/kitchen-learning/cup.png', thai: 'ถ้วย', phonetic: 'thuay', english: 'Cup' },
] as const satisfies readonly TeamLearningIdentity[]

// September 4 fixed-pair roster slots: scoped to this event, never display names.
const KITCHEN_TEAM_ROSTER_IDS: readonly (readonly string[])[] = [
  [
    "5c568584-c095-4d51-ae8f-90e2c80523f5",
    "57d32558-2d16-4b4d-a57c-94ef9e772d83"
  ],
  [
    "df4eb2c2-5a8a-49df-a401-4b541f3ee2b9",
    "f2314246-adf4-4e0d-aa82-253da16c9ac6"
  ],
  [
    "1dd47a55-28ab-46cb-93d7-660eceeaec39",
    "e8afb3aa-8538-4469-8833-85abdce76b01"
  ],
  [
    "dacf7439-02e5-4221-ba1f-d504e3b749d8",
    "31c4a1b9-737b-460e-838a-cd127d70ae63"
  ],
  [
    "bff11e41-8f33-46b9-920d-553638495d34",
    "9620a2f7-49de-440f-a332-9ccd37bd45ab"
  ],
  [
    "c5a271fe-229d-414a-942c-2a9b4d51a18e",
    "3e253fae-f6ce-4e64-ac11-4f74d2a6672c"
  ],
  [
    "b636cd0a-5b39-433f-aef8-193d152ee50c",
    "167fb491-0832-4bcd-8713-140c7838f9fd"
  ],
  [
    "a58baa07-c41f-40c4-a445-29d47e7c40e9",
    "bfd3a6aa-65b9-45be-83e2-7bf54d9cb3f6"
  ]
]

export const TEAM_FRUIT_IDENTITIES = [
  { imageUrl: '/fruit-learning/mango.png', thai: 'มะม่วง', phonetic: 'ma-muang', english: 'Mango' },
  { imageUrl: '/fruit-learning/watermelon.png', thai: 'แตงโม', phonetic: 'taeng-mo', english: 'Watermelon' },
  { imageUrl: '/fruit-learning/pineapple.png', thai: 'สับปะรด', phonetic: 'sap-pa-rot', english: 'Pineapple' },
  { imageUrl: '/fruit-learning/coconut.png', thai: 'มะพร้าว', phonetic: 'ma-phrao', english: 'Coconut' },
  { imageUrl: '/fruit-learning/banana.png', thai: 'กล้วย', phonetic: 'gluay', english: 'Banana' },
  { imageUrl: '/fruit-learning/longan.png', thai: 'ลำไย', phonetic: 'lam-yai', english: 'Longan' },
  { imageUrl: '/fruit-learning/dragon-fruit.png', thai: 'แก้วมังกร', phonetic: 'gaew mang-gorn', english: 'Dragon fruit' },
  { imageUrl: '/fruit-learning/mangosteen.png', thai: 'มังคุด', phonetic: 'mang-kut', english: 'Mangosteen' },
] as const satisfies readonly TeamLearningIdentity[]

/** Legacy offline roster assignment reads image URLs from this symbol. */
export const TEAM_SPIRIT_ANIMAL_ASSETS = TEAM_FRUIT_IDENTITIES.map((identity) => identity.imageUrl)

function canonicalTeamName(name: string): string {
  const normalized = name.trim().toLocaleLowerCase().replace(/[’']/g, '')
  if (normalized === 'pnee' || normalized === 'nee') return 'nee'
  if (normalized === 'paipai' || normalized === 'pai pai' || normalized === 'pai') return 'pai'
  if (normalized === 'mike d') return 'mike'
  if (normalized === 'david moore') return 'david'
  if (normalized === 'peter samui') return 'peter p'
  if (normalized === 'tak kanyanee') return 'tak'
  return normalized
}

function teamKey(playerA: string, playerB: string): string {
  return [canonicalTeamName(playerA), canonicalTeamName(playerB)].sort().join('|')
}

const LEARNING_IDENTITY_BY_TEAM = new Map<string, TeamLearningIdentity>([
  [teamKey('Dave', 'Mike'), TEAM_FRUIT_IDENTITIES[0]],
  [teamKey('David', 'Arzina'), TEAM_FRUIT_IDENTITIES[1]],
  [teamKey('Will', 'Curtis'), TEAM_FRUIT_IDENTITIES[2]],
  [teamKey('Vinny', 'Matt'), TEAM_FRUIT_IDENTITIES[3]],
  [teamKey('Richy', 'Matt'), TEAM_FRUIT_IDENTITIES[3]],
  [teamKey('Fabrice', 'Hocine'), TEAM_FRUIT_IDENTITIES[4]],
  [teamKey('Fabrice', 'Mehdi'), TEAM_FRUIT_IDENTITIES[4]],
  [teamKey('Stephen', 'Lauren'), TEAM_FRUIT_IDENTITIES[5]],
  [teamKey('Nee', 'Kitt'), TEAM_FRUIT_IDENTITIES[6]],
  [teamKey('P’Thida', 'Jeff'), TEAM_FRUIT_IDENTITIES[7]],
  [teamKey('Nee', 'Pai'), TEAM_FRUIT_IDENTITIES[6]],
  [teamKey('Peter P', 'Fabrice'), TEAM_FRUIT_IDENTITIES[4]],
  [teamKey('Phil', 'Jacky'), TEAM_FRUIT_IDENTITIES[2]],
  [teamKey('Rutger', 'Marilyn'), TEAM_FRUIT_IDENTITIES[3]],
  [teamKey('Fed G', 'Tak'), TEAM_FRUIT_IDENTITIES[7]],
])

const MEHDI_TEAM_IDS = new Set([
  '6e0db57c-e5e4-4eb3-ac89-b59ef0ae7af6', // padel_players.id
  '0727ba83-bed7-41c4-a16b-7568f67215e4', // preserved session_players.id
])

export function learningIdentityForTeam(
  playerA: string | null | undefined,
  playerB: string | null | undefined,
  playerIds: readonly (string | null | undefined)[] = [],
): TeamLearningIdentity | null {
  const kitchenTeam = KITCHEN_TEAM_ROSTER_IDS.findIndex((ids) => ids.every((id) => playerIds.includes(id)))
  if (kitchenTeam >= 0) return TEAM_KITCHEN_IDENTITIES[kitchenTeam]
  if (!playerA?.trim() || !playerB?.trim()) return null
  const names = new Set([canonicalTeamName(playerA), canonicalTeamName(playerB)])
  if (names.has('fabrice') && playerIds.some((id) => id && MEHDI_TEAM_IDS.has(id))) {
    return TEAM_FRUIT_IDENTITIES[4]
  }
  return LEARNING_IDENTITY_BY_TEAM.get(teamKey(playerA, playerB)) ?? null
}

/** Compatibility bridge for schedule player data. */
export function spiritAnimalForTeam(
  playerA: string | null | undefined,
  playerB: string | null | undefined,
): string | null {
  return learningIdentityForTeam(playerA, playerB)?.imageUrl ?? null
}
