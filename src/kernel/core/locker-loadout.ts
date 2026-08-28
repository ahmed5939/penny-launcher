import type { CardCosmeticGroup, LockerSlotKey } from '../../config/fortnite/locker'
import type { CosmeticMeta } from './locker-catalog'
import type {
  LockerItemsResponse,
  LockerLoadoutGroupRequest,
} from '../../types/services/locker'

import {
  backendTypesBySlot,
  cardCosmeticGroupOrder,
  cardCosmeticGroups,
  isCardCosmeticGroup,
  schemaBySlot,
  slotKeysByTemplate,
  slotTemplates,
} from '../../config/fortnite/locker'

/**
 * Reading and rewriting a locker, as arithmetic.
 *
 * Split out of `locker.ts` because that module reaches for Electron and for
 * the network, and none of this needs either: it is the part where a wrong
 * answer silently unequips someone's whole locker, so it is the part that
 * has to be testable on its own.
 */

export type LockerCardFilters = {
  /** Empty means every group. */
  groups: Array<CardCosmeticGroup>
  /** Empty means every rarity. fortnite-api tokens, e.g. `legendary`. */
  rarities: Array<string>
  /** Empty means every chapter. */
  chapters: Array<number>
  /** Draw only what is equipped right now. */
  equippedOnly: boolean
}

/** Epic's schema-keyed loadout, flattened to `slotKey → equipped item id`. */
export function parseEquippedSlots(data: LockerItemsResponse | undefined) {
  const loadouts = data?.activeLoadoutGroup?.loadouts ?? {}
  const equipped: Partial<Record<LockerSlotKey, string | null>> = {}

  Object.values(loadouts).forEach((loadout) => {
    loadout.loadoutSlots?.forEach((slot) => {
      const slotKey = slotKeysByTemplate[slot.slotTemplate]

      if (slotKey) {
        equipped[slotKey] = slot.equippedItemId ?? null
      }
    })
  })

  return equipped
}

/**
 * The whole locker, with one slot changed.
 *
 * Rebuilt from exactly what Epic just returned rather than from this app's
 * idea of a locker: a PUT replaces the active loadout group wholesale, so any
 * slot left out of the payload is a slot that comes off — including slots for
 * schemas this app has never heard of. Passing `null` for `templateId`
 * unequips by dropping that one slot from the payload, which is how the game
 * itself clears one.
 */
export function buildLoadoutPayload(
  current: LockerItemsResponse | undefined,
  slotKey: LockerSlotKey,
  templateId: string | null
): LockerLoadoutGroupRequest['loadouts'] {
  const template = slotTemplates[slotKey]
  const source = current?.activeLoadoutGroup?.loadouts ?? {}
  const loadouts: LockerLoadoutGroupRequest['loadouts'] = {}
  let touched = false

  Object.entries(source).forEach(([schemaKey, loadout]) => {
    const slots = (loadout.loadoutSlots ?? []).flatMap((slot) => {
      if (slot.slotTemplate !== template) {
        return [
          {
            slotTemplate: slot.slotTemplate,
            itemCustomizations: slot.itemCustomizations ?? [],
            ...(slot.equippedItemId
              ? { equippedItemId: slot.equippedItemId }
              : {}),
          },
        ]
      }

      touched = true

      return templateId
        ? [
            {
              slotTemplate: template,
              equippedItemId: templateId,
              itemCustomizations: [],
            },
          ]
        : []
    })

    if (slots.length > 0) {
      loadouts[schemaKey] = {
        loadoutSlots: slots,
        shuffleType: loadout.shuffleType ?? 'DISABLED',
      }
    }
  })

  /*
   * A slot the account has never filled is simply absent from the GET, so
   * there is nothing to rewrite — it has to be added under the schema that
   * owns it. This is the only place the static schema map is consulted.
   */
  if (!touched && templateId) {
    const schemaKey = schemaBySlot[slotKey]

    loadouts[schemaKey] = {
      loadoutSlots: [
        ...(loadouts[schemaKey]?.loadoutSlots ?? []),
        {
          slotTemplate: template,
          equippedItemId: templateId,
          itemCustomizations: [],
        },
      ],
      shuffleType: loadouts[schemaKey]?.shuffleType ?? 'DISABLED',
    }
  }

  return loadouts
}

/** Which of the account's cosmetics are legal in a slot. */
export function ownedForSlot(
  cosmetics: Array<CosmeticMeta>,
  slotKey: LockerSlotKey
) {
  const allowed = new Set<string>(backendTypesBySlot[slotKey] ?? [])

  return cosmetics.filter((cosmetic) => allowed.has(cosmetic.backendType))
}

/** Every backend type the card generator knows, mapped to its shelf index. */
export const cardGroupOrder = new Map(
  cardCosmeticGroupOrder.flatMap((group, index) =>
    cardCosmeticGroups[group].map(
      (backendType) => [backendType, index] as [string, number]
    )
  )
)

/**
 * The card's filters, all of which read "empty means everything".
 *
 * That is deliberate rather than an omission: an explicit "All" option has to
 * be kept consistent with the rest of its group, and an empty selection
 * already says the same thing without anything to keep in sync.
 */
export function filterForCard(
  cosmetics: Array<CosmeticMeta>,
  filters: LockerCardFilters,
  equipped: Set<string>
) {
  const allowedTypes = new Set<string>(
    filters.groups.flatMap((group) =>
      isCardCosmeticGroup(group) ? [...cardCosmeticGroups[group]] : []
    )
  )
  const rarities = new Set(filters.rarities.map((value) => value.toLowerCase()))
  const chapters = new Set(filters.chapters)

  return cosmetics.filter((cosmetic) => {
    if (filters.equippedOnly && !equipped.has(cosmetic.templateId)) {
      return false
    }

    if (allowedTypes.size > 0 && !allowedTypes.has(cosmetic.backendType)) {
      return false
    }

    if (rarities.size > 0 && !rarities.has(cosmetic.rarity.toLowerCase())) {
      return false
    }

    if (
      chapters.size > 0 &&
      (cosmetic.chapter === null || !chapters.has(cosmetic.chapter))
    ) {
      return false
    }

    return true
  })
}
