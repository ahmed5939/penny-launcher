/**
 * Optional overhead map underlays for the Outpost explorer.
 *
 * Fortnite has no static "map texture" for Storm Shield zones — the in-game
 * map is a live scene capture, which is why every public overhead (the wiki
 * Endurance reference maps, r/FORTnITE spawn maps) is a screenshot with
 * someone else's base in it. Those cannot be aligned to a save's world
 * coordinates without a calibration reference, so nothing ships by default.
 *
 * To add a zone: take a clean screenshot of the in-game map (M) with your
 * own base visible, drop it under `assets/images/world/outpost/`, register
 * it in `src/images.ts`, then fill in the entry below. Calibrate by matching
 * two known pieces of your build between the screenshot and the 2D
 * blueprint: `pixelsPerCell` is their pixel distance ÷ their cell distance,
 * `originPx` is where world (0, 0) lands once that scale is applied.
 *
 * Zone ids match `OutpostZoneInfo.zoneId` (`pve_01` Stonewood, `pve_02`
 * Plankerton, `pve_03` Canny Valley, `pve_04` Twine Peaks).
 */
export type OutpostMapUnderlay = {
  /** Shown in the explorer legend. */
  credit?: string
  /** Key into the local image map (`src/images.ts`) or an absolute URL. */
  image: string
  /** Mirror the image left↔right after placing it. */
  mirrorX?: boolean
  /** Mirror the image top↔bottom after placing it. */
  mirrorY?: boolean
  /** Pixel position of the save's world origin (x = 0, y = 0). */
  originPx: [number, number]
  /** Image pixels per build cell (one cell = 512 world units). */
  pixelsPerCell: number
  /** Image size in pixels. */
  sizePx: [number, number]
}

/**
 * The image's right edge runs along the blueprint's +Y world axis and its
 * bottom edge along −X — the same quarter turn the 2D blueprint draws with —
 * unless mirrored.
 */
export const OUTPOST_MAP_UNDERLAYS: Record<string, OutpostMapUnderlay> = {}

/** Extent of an underlay in blueprint coordinates (x = world y, y = −world x). */
export function underlayBlueprintRect(underlay: OutpostMapUnderlay) {
  const [originX, originY] = underlay.originPx
  const [width, height] = underlay.sizePx
  const scale = underlay.pixelsPerCell

  return {
    height: height / scale,
    width: width / scale,
    x: -originX / scale,
    y: -originY / scale,
  }
}
