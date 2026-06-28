export const APP_PALETTE = {
  navy: '#061D36',
  darkBlue: '#0B2A4A',
  blue: '#4DA3FF',
  lightBlue: '#7DD3FC',
  cyan: '#22D3EE',
  green: '#2DFFC4',
  yellow: '#EFFF3D',
  orange: '#FF9F1C',
  red: '#FF4D6D',
  pink: '#FF8FD8',
  purple: '#B967FF',
  white: '#F8FAFC',
  mutedWhite: '#D8EEFF',
  black: '#06111F',
} as const

export type AppPaletteColor = keyof typeof APP_PALETTE
