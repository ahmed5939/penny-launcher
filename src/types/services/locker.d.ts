/**
 * Epic Online Services' locker v4 payloads.
 *
 * A locker is an `activeLoadoutGroup` holding one entry per *loadout schema*
 * (`CosmeticLoadout:LoadoutSchema_Character`, `…_Emotes`, …), and each schema
 * holds the slots it owns. A slot with no `equippedItemId` is an empty slot;
 * a slot that is absent entirely has never been filled on this account.
 */

export type EOSTokenResponse = {
  access_token: string
  expires_in?: number
  account_id?: string
}

export type LockerLoadoutSlot = {
  slotTemplate: string
  equippedItemId?: string
  itemCustomizations?: Array<unknown>
}

export type LockerLoadout = {
  loadoutSlots?: Array<LockerLoadoutSlot>
  shuffleType?: string
}

export type LockerItemsResponse = {
  activeLoadoutGroup?: {
    loadouts?: Record<string, LockerLoadout>
  }
}

/** What a PUT to `active-loadout-group` expects: the whole locker, again. */
export type LockerLoadoutGroupRequest = {
  loadouts: Record<
    string,
    {
      loadoutSlots: Array<LockerLoadoutSlot>
      shuffleType: string
    }
  >
}
