export const TEAM_SPIRIT_ANIMAL_ASSETS = [
  '/spirit-animals/fox.png?v=normalized-1',
  '/spirit-animals/rabbit.png?v=normalized-1',
  '/spirit-animals/owl.png?v=normalized-1',
  '/spirit-animals/lion.png?v=normalized-1',
  '/spirit-animals/octopus.png?v=normalized-1',
  '/spirit-animals/deer.png?v=normalized-3',
  '/spirit-animals/squirrel.png?v=normalized-1',
  '/spirit-animals/cat.png?v=normalized-1',
] as const

function canonicalSpiritAnimalName(name: string): string {
  const normalized = name.trim().toLocaleLowerCase().replace(/[’']/g, '')
  if (normalized === 'pnee' || normalized === 'nee') return 'nee'
  if (normalized === 'paipai' || normalized === 'pai pai' || normalized === 'pai') return 'pai'
  if (normalized === 'mike d') return 'mike'
  if (normalized === 'peter samui') return 'peter p'
  if (normalized === 'tak kanyanee') return 'tak'
  return normalized
}

function teamKey(playerA: string, playerB: string): string {
  return [canonicalSpiritAnimalName(playerA), canonicalSpiritAnimalName(playerB)]
    .sort()
    .join('|')
}

const SPIRIT_ANIMAL_BY_TEAM = new Map<string, string>([
  [teamKey('Stephen', 'Lauren'), TEAM_SPIRIT_ANIMAL_ASSETS[0]],
  [teamKey('David', 'Arzina'), TEAM_SPIRIT_ANIMAL_ASSETS[1]],
  [teamKey('Nee', 'Pai'), TEAM_SPIRIT_ANIMAL_ASSETS[2]],
  [teamKey('Dave', 'Mike'), TEAM_SPIRIT_ANIMAL_ASSETS[3]],
  [teamKey('Peter P', 'Fabrice'), TEAM_SPIRIT_ANIMAL_ASSETS[4]],
  [teamKey('Phil', 'Jacky'), TEAM_SPIRIT_ANIMAL_ASSETS[5]],
  [teamKey('Rutger', 'Marilyn'), TEAM_SPIRIT_ANIMAL_ASSETS[6]],
  [teamKey('Fed G', 'Tak'), TEAM_SPIRIT_ANIMAL_ASSETS[7]],

  // Friday 28 Aug fixed pairs. Existing team identities stay unchanged;
  // every new team receives one distinct animal from the same eight-animal set.
  [teamKey('Will', 'Curtis'), TEAM_SPIRIT_ANIMAL_ASSETS[7]],
  [teamKey('Vinny', 'Matt'), TEAM_SPIRIT_ANIMAL_ASSETS[6]],
  [teamKey('Fabrice', 'Hocine'), TEAM_SPIRIT_ANIMAL_ASSETS[4]],
  [teamKey('Nee', 'Kitt'), TEAM_SPIRIT_ANIMAL_ASSETS[2]],
  [teamKey('P’Thida', 'Jeff'), TEAM_SPIRIT_ANIMAL_ASSETS[5]],
])

export function spiritAnimalForTeam(
  playerA: string | null | undefined,
  playerB: string | null | undefined,
): string | null {
  if (!playerA?.trim() || !playerB?.trim()) return null
  return SPIRIT_ANIMAL_BY_TEAM.get(teamKey(playerA, playerB)) ?? null
}
