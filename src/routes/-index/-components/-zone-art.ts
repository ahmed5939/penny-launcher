import { zoneArt } from '../../../components/page'

import { World } from '../../../config/constants/fortnite/world-info'

/**
 * The game's key art for the four campaign zones, by theater id. Ventures
 * and event theaters have no art of their own and get nothing.
 */
const artByTheaterId: Partial<Record<string, string>> = {
  [World.Stonewood]: zoneArt.stonewood,
  [World.Plankerton]: zoneArt.plankerton,
  [World.CannyValley]: zoneArt['canny-valley'],
  [World.TwinePeaks]: zoneArt['twine-peaks'],
}

export function zoneArtForTheater(theaterId: string) {
  return artByTheaterId[theaterId] ?? null
}
