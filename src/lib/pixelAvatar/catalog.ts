import manifest from '../../../public/pixel-avatar/showdown/manifest.json'
import type { GameCharacterFranchise, ShowdownPose } from './catalogTypes'

export type { GameCharacterFranchise, ShowdownPose } from './catalogTypes'

export type GameCharacterCatalogEntry = {
  id: string
  label: string
  franchise: GameCharacterFranchise
  poses: Record<ShowdownPose, string>
}

const SD = '/pixel-avatar/showdown'

export const SHOWDOWN_FRANCHISE_LABELS: Record<GameCharacterFranchise, string> = {
  'street-fighter': 'Street Fighter',
  dbz: 'DBZ',
  naruto: 'Naruto',
  cartoon: 'Cartoon',
}

/** Display names for roster slots — assets appear in the picker once all 3 poses exist on disk. */
const CHARACTER_LABELS: Record<GameCharacterFranchise, Record<string, string>> = {
  'street-fighter': {
    ryu: 'Ryu',
    ken: 'Ken',
    'chun-li': 'Chun-Li',
    guile: 'Guile',
    cammy: 'Cammy',
    dhalsim: 'Dhalsim',
    zangief: 'Zangief',
    blanka: 'Blanka',
    sagat: 'Sagat',
    bison: 'M. Bison',
  },
  dbz: {
    goku: 'Goku',
    vegeta: 'Vegeta',
    gohan: 'Gohan',
    piccolo: 'Piccolo',
    trunks: 'Trunks',
    frieza: 'Frieza',
    cell: 'Cell',
    'majin-buu': 'Majin Buu',
  },
  naruto: {
    naruto: 'Naruto',
    sasuke: 'Sasuke',
    sakura: 'Sakura',
    kakashi: 'Kakashi',
    'rock-lee': 'Rock Lee',
    gaara: 'Gaara',
    itachi: 'Itachi',
  },
  cartoon: {
    blossom: 'Blossom',
    buttercup: 'Buttercup',
    bubbles: 'Bubbles',
  },
}

function posesFor(franchise: GameCharacterFranchise, id: string): Record<ShowdownPose, string> {
  const base = `${SD}/${franchise}/${id}`
  return {
    stance: `${base}/stance.gif`,
    victory: `${base}/victory.gif`,
    loss: `${base}/loss.gif`,
  }
}

function buildCatalog(): GameCharacterCatalogEntry[] {
  return manifest.ready.map(({ franchise, id }) => {
    const franchiseKey = franchise as GameCharacterFranchise
    const label = CHARACTER_LABELS[franchiseKey]?.[id] ?? id
    return { id, label, franchise: franchiseKey, poses: posesFor(franchiseKey, id) }
  })
}

/** Only characters with stance + victory + loss GIFs on disk (see npm run showdown:sync). */
export const GAME_CHARACTER_CATALOG: GameCharacterCatalogEntry[] = buildCatalog()

const byId = new Map(GAME_CHARACTER_CATALOG.map((item) => [item.id, item]))

export function gameCharacterById(id: string): GameCharacterCatalogEntry | undefined {
  return byId.get(id)
}

export function gameCharacterByStanceSrc(src: string): GameCharacterCatalogEntry | undefined {
  return GAME_CHARACTER_CATALOG.find(
    (item) => item.poses.stance === src || Object.values(item.poses).includes(src),
  )
}

export function gameCharactersForFranchise(
  franchise: GameCharacterFranchise | 'all',
): GameCharacterCatalogEntry[] {
  if (franchise === 'all') return GAME_CHARACTER_CATALOG
  return GAME_CHARACTER_CATALOG.filter((item) => item.franchise === franchise)
}

export function resolveCharacterPoseSrc(characterId: string, pose: ShowdownPose): string | null {
  const entry = gameCharacterById(characterId)
  if (!entry) return null
  return entry.poses[pose] ?? entry.poses.stance
}
