/**
 * The in-game loadout panel's palette, for the shareable loadout image. The
 * image imitates the game's own screen rather than the launcher's theme, so
 * it keeps its own colours — the same in light and dark mode.
 */
export const shareCardPalette = {
  /** The panel backdrop, top to bottom. */
  backdropTop: 'rgb(28 44 92)',
  backdropBottom: 'rgb(12 20 48)',
  /** A dark row (perk, gadget, defender). */
  row: 'rgb(20 34 74 / 0.92)',
  /** The square icon well at a row's start. */
  well: 'rgb(12 22 52)',
  /** Section headings: pale blue, slanted, uppercase. */
  heading: 'rgb(150 190 240)',
  /** The team perk bar's glow. */
  perkFrom: 'rgb(168 85 247)',
  perkTo: 'rgb(56 189 248)',
  text: 'rgb(255 255 255)',
  muted: 'rgb(190 205 235)',
  /** The yellow keyline the game draws round the commander. */
  keyline: 'rgb(250 204 21)',
} as const
