export type BookItem = {
  id: string
  templateId: string
  level: number
  portrait: string | null
  personality: string | null
  teamBonus: string | null
  alterations: string[]
}
export type CollectionBookData = {
  accountId: string
  fetchedAt: string
  slotted: BookItem[]
  inventory: BookItem[]
  resources: Record<string, number>
  highestLevel: number | null
}
/**
 * One upgrade of a slotted item, performed in place in the book the way the
 * game's Collection Book does it. `book` names the profile the item lives in.
 */
export type BookUpgradeRequest =
  | { itemId: string; book: 'people' | 'schematics'; action: 'level'; desiredLevel: number }
  | { itemId: string; book: 'people' | 'schematics'; action: 'evolve'; conversionIndex: number }
export function validBookUpgrade(value: unknown): BookUpgradeRequest {
  const r = (value ?? {}) as Record<string, unknown>
  const base = typeof r.itemId === 'string' && /^[\w-]{1,64}$/.test(r.itemId) && (r.book === 'people' || r.book === 'schematics')
  if (base && r.action === 'level' && Number.isInteger(r.desiredLevel) && (r.desiredLevel as number) >= 2 && (r.desiredLevel as number) <= 50)
    return { itemId: r.itemId as string, book: r.book as 'people' | 'schematics', action: 'level', desiredLevel: r.desiredLevel as number }
  if (base && r.action === 'evolve' && (r.conversionIndex === 0 || r.conversionIndex === 1))
    return { itemId: r.itemId as string, book: r.book as 'people' | 'schematics', action: 'evolve', conversionIndex: r.conversionIndex }
  throw new Error('That upgrade is malformed. Refresh and try again.')
}
