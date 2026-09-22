import type { BookItem } from './types'
export type BookSlot = { id: string; name: string; rarity: string; allowed: string[]; personalities: string[]; templateId: string }
export function matchesSlot(item: BookItem, slot: BookSlot) {
  return slot.allowed.includes(item.templateId.split(':').pop()!.toLowerCase()) &&
    (!slot.personalities.length || slot.personalities.includes((item.personality ?? '').toLowerCase()))
}
