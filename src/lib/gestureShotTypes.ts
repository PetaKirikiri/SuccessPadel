export type GestureShotTypeId =
  | 'overhead'
  | 'backhand'
  | 'forehand'
  | 'lob'
  | 'serve'

export type GestureShotTypeDef = {
  id: GestureShotTypeId
  label: string
  tabLabel: string
  summary: string
  winImageSrc: string
  foulImageSrc: string
  winDetail: string
  foulDetail: string
}

export const GESTURE_SHOT_TYPE_ORDER: GestureShotTypeId[] = [
  'overhead',
  'backhand',
  'forehand',
  'lob',
  'serve',
]

export const GESTURE_SHOT_TYPES: Record<GestureShotTypeId, GestureShotTypeDef> = {
  overhead: {
    id: 'overhead',
    label: 'Overhead',
    tabLabel: 'Overhead',
    summary: 'Start on a player in the back court. Draw a straight vertical stroke.',
    winImageSrc: '/gesture-shots/overhead-win.svg',
    foulImageSrc: '/gesture-shots/overhead-foul.svg',
    winDetail: 'Straight line up from a player.',
    foulDetail: 'Straight line down from a player.',
  },
  backhand: {
    id: 'backhand',
    label: 'Backhand',
    tabLabel: 'Backhand',
    summary:
      'Draw toward the player\'s left (across the body). The same stroke near the net counts as a volley.',
    winImageSrc: '/gesture-shots/backhand-win.svg',
    foulImageSrc: '/gesture-shots/backhand-foul.svg',
    winDetail: 'Reach across to the left, then finish up.',
    foulDetail: 'Reach across to the left, then finish lower.',
  },
  forehand: {
    id: 'forehand',
    label: 'Forehand',
    tabLabel: 'Forehand',
    summary:
      'Draw toward the player\'s right (same side). The same stroke near the net counts as a volley.',
    winImageSrc: '/gesture-shots/forehand-win.svg',
    foulImageSrc: '/gesture-shots/forehand-foul.svg',
    winDetail: 'Reach to the right, then finish up.',
    foulDetail: 'Reach to the right, then finish lower.',
  },
  lob: {
    id: 'lob',
    label: 'Lob',
    tabLabel: 'Lob',
    summary: 'From the back court, draw a square C over the net.',
    winImageSrc: '/gesture-shots/lob-win.svg',
    foulImageSrc: '/gesture-shots/lob-foul.svg',
    winDetail: 'Last anchor higher than the first.',
    foulDetail: 'Last anchor lower than the first.',
  },
  serve: {
    id: 'serve',
    label: 'Serve',
    tabLabel: 'Serve',
    summary: 'Optional — one diagonal line from the server. Scores automatically, then tag the receiver\'s shot.',
    winImageSrc: '/gesture-shots/serve-win.svg',
    foulImageSrc: '/gesture-shots/serve-win.svg',
    winDetail: 'One line from the server — point scores right away, then draw what the receiver tried.',
    foulDetail: 'Not tracked — use rally gestures instead.',
  },
}

export function gestureShotTypeLabel(id: GestureShotTypeId): string {
  return GESTURE_SHOT_TYPES[id].label
}

export function gestureShotTypeList(): GestureShotTypeDef[] {
  return GESTURE_SHOT_TYPE_ORDER.map((id) => GESTURE_SHOT_TYPES[id])
}
