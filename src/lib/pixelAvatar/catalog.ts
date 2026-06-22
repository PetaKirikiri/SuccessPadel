export type GameCharacterCategory = 'fighter' | 'anime' | 'cartoon'

export type GameCharacterCatalogEntry = {
  id: string
  label: string
  src: string
  category: GameCharacterCategory
}

/** Sprites face right by default; flip horizontally for the left-side lineup. */
export const GAME_CHARACTER_CATALOG: GameCharacterCatalogEntry[] = [
  { id: 'ryu', label: 'Ryu', src: '/pixel-avatar/fighter-test/ryu.gif', category: 'fighter' },
  { id: 'ken', label: 'Ken', src: '/pixel-avatar/fighter-test/ken.gif', category: 'fighter' },
  {
    id: 'chun-li',
    label: 'Chun-Li',
    src: '/pixel-avatar/fighter-test/chun-li.gif',
    category: 'fighter',
  },
  { id: 'guile', label: 'Guile', src: '/pixel-avatar/fighter-test/guile.gif', category: 'fighter' },
  { id: 'cammy', label: 'Cammy', src: '/pixel-avatar/fighter-test/cammy.gif', category: 'fighter' },
  {
    id: 'ryu-cvs2',
    label: 'Ryu 2',
    src: '/pixel-avatar/fighter-test/ryu-cvs2.gif',
    category: 'fighter',
  },
  {
    id: 'ryu-snk',
    label: 'Ryu 3',
    src: '/pixel-avatar/fighter-test/ryu-snk.gif',
    category: 'fighter',
  },
]

export function gameCharacterBySrc(src: string): GameCharacterCatalogEntry | undefined {
  return GAME_CHARACTER_CATALOG.find((item) => item.src === src)
}
