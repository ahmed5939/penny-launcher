import { afterEach, describe, expect, it, vi } from 'vitest'

const accountId = 'a'.repeat(32)
const mocks = vi.hoisted(() => {
  const state = { primary: 'a'.repeat(32), listener: null as null | (() => void) }
  return {
    state,
    bridge: {
      getAccountScope: () => ({ primary: state.primary, members: [state.primary] }),
      on: (_plugin: string, _event: string, listener: () => void) => {
        state.listener = listener
        return () => {
          state.listener = null
        }
      },
    },
  }
})
vi.mock('../startup/plugin-api', () => ({ PluginBridge: mocks.bridge }))
vi.mock('../startup/accounts', () => ({ AccountsManager: { getAccountById: (id: string) => (id === accountId ? { accountId } : undefined) } }))
vi.mock('./authentication', () => ({ Authentication: { verifyAccessToken: async () => 'test-only-token' } }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: () => undefined } }))

import { requestSixthPerks } from './sixth-perks'

/** Every QueryProfile answers with an empty profile; `during` runs mid-request. */
function stubFetch(during: () => void = () => undefined) {
  const fetch = vi.fn(async (url: string) => {
    during()
    const profileId = new URL(url).searchParams.get('profileId')
    return { ok: true, status: 200, json: async () => ({ profileChanges: [{ profile: { accountId, profileId, items: {} } }] }) }
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
function emit(primary: string) {
  mocks.state.primary = primary
  mocks.state.listener?.()
}

describe('6th perks main-process scan', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    mocks.state.primary = accountId
    mocks.state.listener = null
  })

  it('reads both profiles through an identical scope refresh and stops listening', async () => {
    const fetch = stubFetch(() => emit(accountId))
    const result = await requestSixthPerks(accountId, true)
    expect(result.inventory.status).toBe('success')
    expect(result.book.status).toBe('success')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(mocks.state.listener).toBeNull()
  })

  it('discards the scan when the selection switches away and back, and stops listening', async () => {
    stubFetch(() => {
      emit('b'.repeat(32))
      emit(accountId)
    })
    await expect(requestSixthPerks(accountId, true)).rejects.toThrow(/Account selection changed/)
    expect(mocks.state.listener).toBeNull()
  })

  it('skips the Collection Book by default and reads one profile', async () => {
    const fetch = stubFetch(() => emit(accountId))
    const result = await requestSixthPerks(accountId)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.book.status).toBe('skipped')
    expect(result.inventory.status).toBe('success')
    expect(mocks.state.listener).toBeNull()
  })

  it('reports a failed read as an error, never as an empty inventory', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })))
    const result = await requestSixthPerks(accountId)
    expect(result.inventory).toEqual({ status: 'error', items: [], error: expect.any(String) })
  })
})
