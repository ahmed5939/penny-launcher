import type { FortniteApiCosmetic } from '../../types/services/cosmetics'
import type { CosmeticMeta, CosmeticsCatalog } from './locker-catalog'

import { resolveCosmetic, splitTemplateId } from './locker-catalog'

/**
 * Sidekicks — the whole catalogue, owned or not.
 *
 * Every other locker view starts from what the account *has*. This one
 * starts from what *exists*: fortnite-api publishes every sidekick Epic has
 * shipped (`CosmeticCompanion` in its catalogue), and the account's athena
 * profile says which of them it holds. The difference is the shopping list.
 *
 * Two spellings meet here. fortnite-api files sidekicks under
 * `CosmeticCompanion`; the profile files the very same items under
 * `CosmeticMimosa`, often with a pose suffix on the id
 * (`companion_flourcut:70c`). Ownership is therefore decided on the bare
 * id, never on the prefix.
 */

/** fortnite-api's type for a sidekick. */
export const companionBackendType = 'CosmeticCompanion'

/** What the athena profile calls the same thing. */
export const companionProfileBackendType = 'CosmeticMimosa'

export type CompanionCollectionEntry = CosmeticMeta & {
  owned: boolean
  description: string | null
}

/** `companion_flourcut:70c` → `companion_flourcut`. */
export function companionBaseId(id: string) {
  return id.split(':')[0].toLowerCase()
}

/**
 * The real sidekicks in the catalogue.
 *
 * Two entries are dropped: Epic's own `Companion_Placeholder` (no name, no
 * art — the empty slot) and `Mimosa_Random`, which is the "pick one of my
 * favourites" option rather than a creature anyone can own.
 */
export function listCatalogCompanions(catalog: CosmeticsCatalog) {
  const seen = new Set<string>()
  const companions: Array<FortniteApiCosmetic> = []

  catalog.br.forEach((cosmetic) => {
    if (cosmetic.type?.backendValue !== companionBackendType || !cosmetic.id) {
      return
    }

    const id = cosmetic.id.toLowerCase()

    /* The catalogue map holds aliases too; each item is wanted once. */
    if (seen.has(id) || !id.startsWith('companion_') || !cosmetic.name) {
      return
    }

    seen.add(id)
    companions.push(cosmetic)
  })

  return companions
}

/**
 * Every sidekick, flagged by whether `ownedTemplateIds` includes it.
 *
 * Owned ids may arrive as full template ids from either side
 * (`CosmeticMimosa:companion_foo:70c`, `CosmeticCompanion:Companion_Foo`) or
 * as bare ids; all three collapse to the same key.
 *
 * Sorted owned-first, then by name, so the top of the grid is what the
 * account has and the tail is what it is missing.
 */
export function buildCompanionCollection(
  catalog: CosmeticsCatalog,
  ownedTemplateIds: Iterable<string>
): Array<CompanionCollectionEntry> {
  const owned = new Set<string>()

  for (const templateId of ownedTemplateIds) {
    owned.add(companionBaseId(splitTemplateId(templateId).id))
  }

  return listCatalogCompanions(catalog)
    .map((cosmetic) => {
      const id = cosmetic.id as string
      const meta = resolveCosmetic(catalog, `${companionBackendType}:${id}`)

      return {
        ...meta,
        owned: owned.has(companionBaseId(id)),
        description: cosmetic.description?.trim() || null,
      }
    })
    .sort(
      (a, b) =>
        Number(b.owned) - Number(a.owned) || a.name.localeCompare(b.name)
    )
}
