export type TeamLearningIdentity = {
  imageUrl: string
  thai: string
  phonetic: string
  english: string
}

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
  [teamKey('Stephen', 'Lauren'), TEAM_FRUIT_IDENTITIES[5]],
  [teamKey('Nee', 'Kitt'), TEAM_FRUIT_IDENTITIES[6]],
  [teamKey('P’Thida', 'Jeff'), TEAM_FRUIT_IDENTITIES[7]],
  [teamKey('Nee', 'Pai'), TEAM_FRUIT_IDENTITIES[6]],
  [teamKey('Peter P', 'Fabrice'), TEAM_FRUIT_IDENTITIES[4]],
  [teamKey('Phil', 'Jacky'), TEAM_FRUIT_IDENTITIES[2]],
  [teamKey('Rutger', 'Marilyn'), TEAM_FRUIT_IDENTITIES[3]],
  [teamKey('Fed G', 'Tak'), TEAM_FRUIT_IDENTITIES[7]],
])

export function learningIdentityForTeam(
  playerA: string | null | undefined,
  playerB: string | null | undefined,
): TeamLearningIdentity | null {
  if (!playerA?.trim() || !playerB?.trim()) return null
  return LEARNING_IDENTITY_BY_TEAM.get(teamKey(playerA, playerB)) ?? null
}

/** Compatibility bridge for schedule player data. */
export function spiritAnimalForTeam(
  playerA: string | null | undefined,
  playerB: string | null | undefined,
): string | null {
  return learningIdentityForTeam(playerA, playerB)?.imageUrl ?? null
}
