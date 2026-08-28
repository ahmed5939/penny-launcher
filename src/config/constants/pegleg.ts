/**
 * PegLeg's exported game data.
 *
 * Epic ships item names, descriptions, perks and icons inside the game's
 * `.uasset` files, which this app has no way to read. PegLeg publishes them
 * already extracted, keyed by the exact template id the MCP profile returns,
 * which is the only practical way to show a real item rather than a decoded
 * template id and a generic rarity voucher.
 *
 * @see https://github.com/PegLegFN/PegLegResources
 * @see https://github.com/PegLegFN/PegLegResourcePackager — how it is built
 */

export const peglegResourcesRepository = 'PegLegFN/PegLegResources'

/** Their working branch. `main` is empty. */
export const peglegResourcesBranch = 'major'

export const peglegResourcesBaseURL = `https://raw.githubusercontent.com/${peglegResourcesRepository}/${peglegResourcesBranch}`

/**
 * The item families the app reads.
 *
 * `Weapon.json` is deliberately absent: at 27MB it is the per-level stat
 * table for crafted weapons, and nothing here shows crafted weapons — the
 * profile holds schematics. Everything listed comes to ~13MB over the wire
 * and ~1.2MB once narrowed.
 *
 * `WorkerPortrait` is the odd one out: it names no item the profile can hold.
 * It is the 95 faces the game picks from when it rolls a survivor, and a
 * survivor's profile item points at one through its `portrait` attribute —
 * without it every unnamed survivor in the account is the same silhouette.
 */
export const peglegNamedItemFiles = [
  'Ability',
  'AccountResource',
  'Alteration',
  'CardPack',
  'Defender',
  'Gadget',
  'Hero',
  'Ingredient',
  'Quest',
  'Schematic',
  'TeamPerk',
  'Trap',
  'Worker',
  'WorkerPortrait',
] as const

/**
 * Item art, served straight from the resources repository.
 *
 * `raw.githubusercontent.com` is already in the renderer's `img-src` policy,
 * and the ~5,900 exported images total 200MB, so they are linked rather than
 * bundled and left to the browser cache.
 */
export function peglegImageURL(fileName: string) {
  return `${peglegResourcesBaseURL}/GameAssets/ExportedImages/${fileName}`
}
