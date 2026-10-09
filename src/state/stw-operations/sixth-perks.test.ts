import type { SixthPerksScan } from '../../features/sixth-perks/types'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { currentSession, useSixthPerksStore } from './sixth-perks'

const A = 'a'.repeat(32)
const B = 'b'.repeat(32)

const result = (accountId: string, includeBook = false): SixthPerksScan => ({
  accountId,
  fetchedAt: '',
  inventory: { status: 'success', items: [], error: null },
  book: includeBook ? { status: 'success', items: [], error: null } : { status: 'skipped', items: [], error: null },
})

/** Replies resolve only when the test says so, so the order can be chosen. */
function stubScans() {
  const pending: Array<{ accountId: string; includeBook: boolean; resolve: (scan: SixthPerksScan) => void; reject: (error: Error) => void }> = []
  vi.stubGlobal('window', {
    electronAPI: {
      requestSixthPerks: (accountId: string, includeBook: boolean) =>
        new Promise<SixthPerksScan>((resolve, reject) => pending.push({ accountId, includeBook, resolve, reject })),
    },
  })
  return pending
}

describe('6th Perks scan session', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useSixthPerksStore.setState({ includeBook: false, session: null, focusWeapon: null })
  })

  it('keeps the Collection Book off by default and keeps a scan for its account only', async () => {
    const pending = stubScans()
    const { scan } = useSixthPerksStore.getState()
    const done = scan(A)
    expect(pending[0]).toMatchObject({ accountId: A, includeBook: false })
    pending[0].resolve(result(A))
    await done
    expect(currentSession(useSixthPerksStore.getState(), A)?.scan?.accountId).toBe(A)
    expect(currentSession(useSixthPerksStore.getState(), B)).toBeNull()
  })

  it('drops a reply that lands after a newer scan started', async () => {
    const pending = stubScans()
    const { scan } = useSixthPerksStore.getState()
    const first = scan(A)
    const second = scan(B)
    pending[1].resolve(result(B))
    pending[0].resolve(result(A))
    await Promise.all([first, second])
    expect(useSixthPerksStore.getState().session?.accountId).toBe(B)
    expect(currentSession(useSixthPerksStore.getState(), A)).toBeNull()
  })

  it('needs a new scan after the Collection Book setting changes, and drops the old reply', async () => {
    const pending = stubScans()
    const { scan, setIncludeBook } = useSixthPerksStore.getState()
    const first = scan(A)
    setIncludeBook(true)
    pending[0].resolve(result(A))
    await first
    expect(currentSession(useSixthPerksStore.getState(), A)).toBeNull()
  })

  it('reports a failed scan without inventing a result', async () => {
    const pending = stubScans()
    const done = useSixthPerksStore.getState().scan(A)
    pending[0].reject(new Error('Request failed.'))
    await done
    const session = currentSession(useSixthPerksStore.getState(), A)
    expect(session?.scan).toBeNull()
    expect(session?.loading).toBe(false)
    expect(session?.error).toMatch(/Could not scan/)
  })

  it('rejects a reply for a different account', async () => {
    const pending = stubScans()
    const done = useSixthPerksStore.getState().scan(A)
    pending[0].resolve(result(B))
    await done
    expect(currentSession(useSixthPerksStore.getState(), A)?.scan).toBeNull()
  })
})
