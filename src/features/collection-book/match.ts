import type { BookItem } from './types'
export type BookSlot = { id: string; name: string; rarity: string; allowed: string[]; personalities: string[]; templateId: string }
export function matchesSlot(item: BookItem, slot: BookSlot) {
  return slot.allowed.includes(item.templateId.split(':').pop()!.toLowerCase()) &&
    (!slot.personalities.length || slot.personalities.includes((item.personality ?? '').toLowerCase()))
}

/** Match each item once against slots accepting its template, preserving item order. */
export function indexBookSlots(slots: BookSlot[], items: BookItem[]) {
  const candidates = new Map<string, Set<BookSlot>>()
  for (const slot of slots) {
    for (const id of slot.allowed) {
      const key = id.toLowerCase()
      if (!candidates.has(key)) candidates.set(key, new Set())
      candidates.get(key)!.add(slot)
    }
  }

  const bySlot = new Map<BookSlot, BookItem[]>()
  const firstSlotByItemId = new Map<string, BookSlot>()
  for (const item of items) {
    const key = item.templateId.split(':').pop()!.toLowerCase()
    for (const slot of candidates.get(key) ?? []) {
      if (!matchesSlot(item, slot)) continue
      if (!bySlot.has(slot)) bySlot.set(slot, [])
      bySlot.get(slot)!.push(item)
      if (!firstSlotByItemId.has(item.id)) firstSlotByItemId.set(item.id, slot)
    }
  }
  return { bySlot, firstSlotByItemId }
}
