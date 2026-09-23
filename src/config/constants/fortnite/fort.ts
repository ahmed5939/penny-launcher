/**
 * F.O.R.T. stat colours, matching the in-game stat icons. The one palette
 * for Fortitude / Offense / Resistance / Tech anywhere in the launcher —
 * main-campaign research and Ventures alike.
 */
export const fortStats = [
  { key: 'fortitude', label: 'Fortitude', color: '#ff5f4a' },
  { key: 'offense', label: 'Offense', color: '#ffb42e' },
  { key: 'resistance', label: 'Resistance', color: '#4ec9ff' },
  { key: 'technology', label: 'Tech', color: '#a97bff' },
] as const

export type FortStatKey = (typeof fortStats)[number]['key']
