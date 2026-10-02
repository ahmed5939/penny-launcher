import type {
  SpriteCollection,
  SpriteEntry,
  SpriteFamilySummary,
} from './sprite-collection'

/**
 * What an account's Sprite Dust can buy back.
 *
 * A lost sprite — encountered in a match, not extracted — can be summoned
 * again for its catalogue cost. This works out the cheapest-first order,
 * how far the current balance gets down that list, and which creatures are
 * one or two treatments short of a full set. It only plans: the app never
 * summons anything.
 *
 * Pure, like `buildSpriteCollection`, so the arithmetic is testable.
 */

export type SpriteRecoveryStep = {
  entry: SpriteEntry
  /**
   * The summon cost, or null when the live catalogue does not list the relic
   * (only currently summonable sprites carry a cost). Unknown costs go last
   * and are never counted as affordable — guessing would be presenting an
   * estimate as fact.
   */
  cost: number | null
  /** Running total of known costs down to this row; null for unknown costs. */
  cumulative: number | null
  /** The balance covers this row and every cheaper one before it. */
  affordable: boolean
}

export type SpriteNearlyCompleteFamily = {
  family: SpriteFamilySummary
  /** The treatments still to secure, lost ones first, cheapest first. */
  needs: Array<SpriteEntry>
}

export type SpriteRecoveryPlan = {
  /** Null when the inventory did not report a balance — unavailable, not 0. */
  dust: number | null
  lost: Array<SpriteRecoveryStep>
  affordableCount: number
  /** Sum of every known cost; sprites with no cost are left out. */
  totalCost: number
  /** Lost sprites the catalogue has no cost for. */
  unknownCostCount: number
  almostComplete: Array<SpriteNearlyCompleteFamily>
}

/** A family this many treatments short or fewer counts as almost complete. */
const almostCompleteGap = 2

function byCostThenName(a: SpriteEntry, b: SpriteEntry) {
  if (a.summonCost === null || b.summonCost === null) {
    if (a.summonCost !== b.summonCost) {
      return a.summonCost === null ? 1 : -1
    }
  } else if (a.summonCost !== b.summonCost) {
    return a.summonCost - b.summonCost
  }

  return (
    a.familyName.localeCompare(b.familyName) ||
    a.variantLabel.localeCompare(b.variantLabel)
  )
}

export function planSpriteRecovery(
  collection: SpriteCollection
): SpriteRecoveryPlan {
  const dust = collection.spriteDust
  const lostEntries = collection.families
    .flatMap((family) => family.variants)
    .filter((entry) => entry.lost)
    .sort(byCostThenName)

  let running = 0
  let affordableCount = 0

  /*
   * Cheapest first is what makes "affordable" a prefix: once one row does
   * not fit, no later row can, because the running total only grows.
   */
  const lost = lostEntries.map((entry): SpriteRecoveryStep => {
    if (entry.summonCost === null) {
      return { entry, cost: null, cumulative: null, affordable: false }
    }

    running += entry.summonCost

    const affordable = dust !== null && running <= dust

    if (affordable) {
      affordableCount += 1
    }

    return {
      entry,
      cost: entry.summonCost,
      cumulative: running,
      affordable,
    }
  })

  const almostComplete = collection.families
    .filter((family) => {
      const gap = family.variants.length - family.ownedCount

      return family.ownedCount > 0 && gap > 0 && gap <= almostCompleteGap
    })
    .map((family) => ({
      family,
      needs: family.variants
        .filter((entry) => !entry.owned)
        .sort(
          (a, b) => Number(b.lost) - Number(a.lost) || byCostThenName(a, b)
        ),
    }))
    .sort(
      (a, b) =>
        a.needs.length - b.needs.length ||
        a.family.name.localeCompare(b.family.name)
    )

  return {
    dust,
    lost,
    affordableCount,
    totalCost: running,
    unknownCostCount: lost.filter((step) => step.cost === null).length,
    almostComplete,
  }
}
