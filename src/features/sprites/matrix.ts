import type {
  SpriteCollection,
  SpriteEntry,
} from '../../kernel/core/sprite-collection'

/**
 * Every account's sprites side by side.
 *
 * Each account's collection is built from the same spine (live catalogue,
 * bundled data, its own inventory), so a row is one creature-and-treatment
 * and a column is one account. Rows are keyed on the parsed family and
 * treatment rather than the relic id, because an inventory can spell an id
 * its own way and the same sprite must still land on one row.
 *
 * Pure, so the counting the stat line and the ownership filter rely on is
 * testable without a renderer.
 */

export type SpriteMatrixInput = {
  accountId: string
  collection: SpriteCollection
}

export type SpriteMatrixCell = Pick<
  SpriteEntry,
  'status' | 'mastered' | 'equipped' | 'xp'
>

export type SpriteMatrixRow = {
  key: string
  /** The sprite as the first account that lists it describes it. */
  entry: SpriteEntry
  /** By account id; an account with no row here has not been read. */
  cells: Record<string, SpriteMatrixCell>
  ownedBy: number
  lostOn: number
}

export type SpriteMatrixFamily = {
  family: string
  name: string
  rarity: string
  ability: string | null
  iconFile: string | null
  rows: Array<SpriteMatrixRow>
}

export type SpriteMatrix = {
  families: Array<SpriteMatrixFamily>
  /** Accounts with a collection — what "owned by all" is measured against. */
  readCount: number
  totals: {
    sprites: number
    ownedAnywhere: number
    lostAnywhere: number
    /** Account-and-sprite pairs reading as lost. */
    lostPairs: number
    /** Sum of the balances that were reported; null when none were. */
    dust: number | null
    /** Accounts read whose inventory did not report a balance. */
    dustUnknown: number
  }
}

export type MatrixOwnership = 'all' | 'none' | 'some' | 'every' | 'lost'

const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common']

function rarityRank(rarity: string) {
  const index = rarityOrder.indexOf(rarity)

  return index < 0 ? rarityOrder.length : index
}

export function buildSpriteMatrix(
  inputs: Array<SpriteMatrixInput>
): SpriteMatrix {
  const families = new Map<string, SpriteMatrixFamily>()
  const rows = new Map<string, SpriteMatrixRow>()
  let dust: number | null = null
  let dustUnknown = 0

  inputs.forEach(({ accountId, collection }) => {
    if (collection.spriteDust === null) {
      dustUnknown += 1
    } else {
      dust = (dust ?? 0) + collection.spriteDust
    }

    collection.families.forEach((summary) => {
      let family = families.get(summary.family)

      if (!family) {
        family = {
          family: summary.family,
          name: summary.name,
          rarity: summary.rarity,
          ability: summary.ability,
          iconFile: summary.iconFile,
          rows: [],
        }
        families.set(summary.family, family)
      }

      summary.variants.forEach((entry) => {
        const key = `${entry.family}::${entry.variant}`
        let row = rows.get(key)

        if (!row) {
          row = { key, entry, cells: {}, ownedBy: 0, lostOn: 0 }
          rows.set(key, row)
          family.rows.push(row)
        }

        row.cells[accountId] = {
          status: entry.status,
          mastered: entry.mastered,
          equipped: entry.equipped,
          xp: entry.xp,
        }

        if (entry.owned) {
          row.ownedBy += 1
        } else if (entry.lost) {
          row.lostOn += 1
        }
      })
    })
  })

  const ordered = [...families.values()].sort(
    (a, b) =>
      rarityRank(a.rarity) - rarityRank(b.rarity) || a.name.localeCompare(b.name)
  )
  const all = ordered.flatMap((family) => family.rows)

  return {
    families: ordered,
    readCount: inputs.length,
    totals: {
      sprites: all.length,
      ownedAnywhere: all.filter((row) => row.ownedBy > 0).length,
      lostAnywhere: all.filter((row) => row.lostOn > 0).length,
      lostPairs: all.reduce((sum, row) => sum + row.lostOn, 0),
      dust,
      dustUnknown,
    },
  }
}

export function matchesOwnership(
  row: SpriteMatrixRow,
  ownership: MatrixOwnership,
  readCount: number
) {
  switch (ownership) {
    case 'none':
      return row.ownedBy === 0
    case 'some':
      return row.ownedBy > 0 && row.ownedBy < readCount
    case 'every':
      return readCount > 0 && row.ownedBy === readCount
    case 'lost':
      return row.lostOn > 0
    default:
      return true
  }
}

/**
 * The families still showing under the filters, each with only its matching
 * rows. A search matches a family's name or ability, or a treatment's name.
 */
export function filterSpriteMatrix(
  matrix: SpriteMatrix,
  {
    ownership,
    query,
    rarity,
  }: { ownership: MatrixOwnership; query: string; rarity: string }
) {
  const needle = query.trim().toLowerCase()

  return matrix.families
    .filter((family) => rarity === 'all' || family.rarity === rarity)
    .map((family) => {
      const familyHit =
        needle.length === 0 ||
        family.name.toLowerCase().includes(needle) ||
        (family.ability?.toLowerCase().includes(needle) ?? false)

      return {
        ...family,
        rows: family.rows.filter(
          (row) =>
            matchesOwnership(row, ownership, matrix.readCount) &&
            (familyHit ||
              row.entry.variantLabel.toLowerCase().includes(needle))
        ),
      }
    })
    .filter((family) => family.rows.length > 0)
}
