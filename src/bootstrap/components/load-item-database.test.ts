import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const effects = vi.hoisted(() => [] as Array<() => (() => void) | void>)
vi.mock('react', () => ({ useEffect: (effect: () => (() => void) | void) => effects.push(effect), useSyncExternalStore: vi.fn() }))

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); effects.length = 0 })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('evicts unused and hidden data, reloads on return, and drops late responses', async () => {
  const doc = { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('document', doc)
  const api = { requestItemDatabase: vi.fn(), responseItemDatabase: vi.fn<(callback: (data: unknown) => void) => { removeListener: ReturnType<typeof vi.fn> }>().mockReturnValue({ removeListener: vi.fn() }) }
  vi.stubGlobal('window', { electronAPI: api })
  const { LoadItemDatabase, useRequestItemDatabase } = await import('./load-item-database')
  const { useItemDatabaseStore } = await import('../../state/items/database')
  LoadItemDatabase()
  effects.pop()!()
  const respond = api.responseItemDatabase.mock.calls[0][0]
  const payload = { total: 1, records: { item: {} }, fetchedAt: 'today' }
  useRequestItemDatabase()
  let release = effects.pop()!()!
  expect(api.requestItemDatabase).toHaveBeenCalledTimes(1)
  respond(payload)
  release()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(useItemDatabaseStore.getState().total).toBe(0)
  useRequestItemDatabase()
  release = effects.pop()!()!
  expect(api.requestItemDatabase).toHaveBeenCalledTimes(2)
  doc.hidden = true
  const visibility = doc.addEventListener.mock.calls[0][1] as () => void
  visibility()
  respond(payload)
  expect(useItemDatabaseStore.getState().total).toBe(0)
  doc.hidden = false
  visibility()
  expect(api.requestItemDatabase).toHaveBeenCalledTimes(3)
  respond(payload)
  doc.hidden = true
  visibility()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(useItemDatabaseStore.getState().total).toBe(0)
  release()
})
