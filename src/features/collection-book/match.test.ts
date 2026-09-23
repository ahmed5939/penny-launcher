import { describe, expect, it } from 'vitest'
import { indexBookSlots, matchesSlot } from './match'
import type { BookSlot } from './match'
import type { BookItem } from './types'

const item = (id: string, templateId: string, personality: string | null = null): BookItem => ({
  id, templateId, personality, level: 1, portrait: null, teamBonus: null, alterations: [],
})

describe('indexed Collection Book matching', () => {
  it('preserves exact matching, item order and the first matching catalog slot', () => {
    const general: BookSlot = { id: 'general', name: 'General', rarity: 'Rare', allowed: ['workerbasic_c_t02', 'workerbasic_c_t02'], personalities: [], templateId: 'Worker:workerbasic_c_t02' }
    const pragmatic: BookSlot = { id: 'pragmatic', name: 'Pragmatic', rarity: 'Rare', allowed: ['workerbasic_c_t02'], personalities: ['homebase.worker.personality.ispragmatic'], templateId: 'Worker:workerbasic_c_t02' }
    const items = [item('first', 'Worker:workerbasic_c_t02', 'Homebase.Worker.Personality.IsPragmatic'), item('other', 'Worker:other'), item('second', 'Worker:workerbasic_c_t02')]
    const indexed = indexBookSlots([pragmatic, general], items)

    expect(indexed.bySlot.get(pragmatic)).toEqual(items.filter((candidate) => matchesSlot(candidate, pragmatic)))
    expect(indexed.bySlot.get(general)).toEqual(items.filter((candidate) => matchesSlot(candidate, general)))
    expect(indexed.firstSlotByItemId.get('first')).toBe(pragmatic)
    expect(indexed.firstSlotByItemId.get('second')).toBe(general)
    expect(indexed.firstSlotByItemId.has('other')).toBe(false)
  })
})
