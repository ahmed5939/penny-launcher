export const worldProfiles = { backpack: 'theater0', storage: 'outpost0' } as const
export type WorldInventoryLocation = keyof typeof worldProfiles
export type WorldItem = { id: string; templateId: string; category: string; quantity: number; level: number | null; durability: number | null; favorite: boolean; alterations: string[]; alterationSlots?: (string | null)[] }
export type WorldInventory = { accountId: string; location: WorldInventoryLocation; fetchedAt: string; items: WorldItem[] }
export function parseWorldProfile(body: unknown, accountId: string, location: WorldInventoryLocation): WorldInventory {
  const response = body as { errorCode?: string; profileChanges?: { profile?: { accountId?: string; profileId?: string; items?: Record<string, { templateId?: string; quantity?: number; attributes?: Record<string, unknown> }> } }[] }
  const profile = response?.profileChanges?.find((c) => c.profile?.profileId === worldProfiles[location])?.profile
  if (response?.errorCode || !profile?.items || profile.accountId !== accountId) throw new Error('Epic returned an incomplete or mismatched inventory. Try Refresh.')
  const items = Object.entries(profile.items).flatMap(([id, item]): WorldItem[] => {
    if (typeof item.templateId !== 'string') return []
    if (location === 'backpack' && /^Weapon:(?:buildingitemdata_(?:floor|roofs|stair_w|wall)|edittool)$/i.test(item.templateId)) return []
    const a = item.attributes ?? {}
    const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
    return [{ id, templateId: item.templateId, category: item.templateId.split(':')[0], quantity: number(item.quantity) ?? 1, level: number(a.level), durability: number(a.durability), favorite: a.favorite === true,
      alterations: Array.isArray(a.alterations) ? a.alterations.filter((v): v is string => typeof v === 'string' && !!v) : [],
      alterationSlots: Array.isArray(a.alterations) ? a.alterations.map((v) => typeof v === 'string' && v ? v : null) : [] }]
  }).filter((i) => i.quantity > 0)
  return { accountId, location, fetchedAt: new Date().toISOString(), items }
}
/** One stack moving between backpack (theater0) and storage (outpost0). `toStorage` is the direction. */
export type WorldTransfer = { itemId: string; quantity: number; toStorage: boolean }
export function validWorldTransfers(value: unknown): WorldTransfer[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) throw new Error('Choose between 1 and 500 stacks to move.')
  return value.map((op) => {
    const { itemId, quantity, toStorage } = (op ?? {}) as Partial<WorldTransfer>
    if (typeof itemId !== 'string' || !/^[\w-]{1,64}$/.test(itemId) || typeof toStorage !== 'boolean' || !Number.isInteger(quantity) || (quantity as number) < 1) throw new Error('That transfer is malformed. Refresh and try again.')
    return { itemId, quantity: quantity as number, toStorage }
  })
}
