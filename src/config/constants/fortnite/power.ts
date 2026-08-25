/**
 * Item power level.
 *
 * Tier and level on their own say very little — a Legendary tier-3 at level
 * 29 and an Epic tier-4 at level 31 are not comparable by eye. Power is the
 * number the game actually shows and the number people compare, so it is the
 * headline figure everywhere in this app.
 *
 * The tables come from the game's own `ItemRatings` data table, published by
 * PegLeg. Each rarity/tier bucket lists one rating per level, starting at
 * `FirstLevel`; the rating for an item is simply the entry for its level.
 *
 * @see https://github.com/PegLegFN/PegLegResources
 */

export type RatingTier = {
  FirstLevel: number
  Ratings: Array<number>
}

export type RatingTable = {
  Tiers: Record<string, RatingTier>
}

/**
 * `Default` covers heroes, schematics, traps and defenders; survivors and
 * lead survivors are rated on their own curves.
 */
export type RatingTables = {
  Default?: RatingTable
  LeadSurvivor?: RatingTable
  Survivor?: RatingTable
}

/** Template ids spell rarity as `_sr_`; the rating table keys it as `SR`. */
const rarityCodePattern = /_(ur|sr|vr|uc|r|c)_/

function tableFor(templateId: string): keyof RatingTables {
  const body = templateId.toLowerCase()

  if (!body.startsWith('worker:')) {
    return 'Default'
  }

  return body.includes('manager') ? 'LeadSurvivor' : 'Survivor'
}

/**
 * @returns the item's power level, or `null` when the template id carries no
 *   rarity/tier or the tables have not been downloaded yet.
 */
export function computeItemPower({
  level,
  tables,
  templateId,
}: {
  level: number
  tables: RatingTables | null | undefined
  templateId: string
}): number | null {
  if (!tables) {
    return null
  }

  const body = templateId.toLowerCase()
  const rarityMatch = rarityCodePattern.exec(body)
  const tierMatch = /_t(\d+)/.exec(body)

  if (!rarityMatch || !tierMatch) {
    return null
  }

  const table = tables[tableFor(templateId)]
  const key = `${rarityMatch[1].toUpperCase()}_T${tierMatch[1].padStart(2, '0')}`
  const tier = table?.Tiers?.[key]

  if (!tier || tier.Ratings.length <= 0) {
    return null
  }

  /**
   * Clamped rather than checked: a profile can hold an item one level past
   * what the shipped table knows about right after a patch, and the nearest
   * rating is a far better answer than none.
   */
  const index = Math.min(
    Math.max(level - tier.FirstLevel, 0),
    tier.Ratings.length - 1
  )

  return Math.round(tier.Ratings[index])
}
