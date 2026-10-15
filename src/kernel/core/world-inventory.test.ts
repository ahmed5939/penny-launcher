import { afterEach, describe, expect, it, vi } from 'vitest'

const accountId = 'a'.repeat(32)
const mocks = vi.hoisted(() => ({ verify: vi.fn(async () => 'test-only-token') }))
vi.mock('./authentication', () => ({ Authentication: { verifyAccessToken: mocks.verify } }))
vi.mock('../startup/accounts', () => ({ AccountsManager: { getAccounts: () => new Map([[accountId, { accountId }]]) } }))

import { UserError, publicIpcMessage } from '../user-error'
import { transferWorldItems } from './world-inventory'

const transfers = [{ itemId: 'stack-1', quantity: 5, toStorage: true }]
const epicError = 'errors.com.epicgames.fortnite.storage_full: Storage is full at C:\\Users\\ahmed'

describe('world inventory transfer errors', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not forward the error text Epic returns', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ errorCode: 'errors.com.epicgames.fortnite.storage_full', errorMessage: epicError }) })))

    const error = await transferWorldItems(accountId, transfers).catch((failure: Error) => failure)

    expect(error).toBeInstanceOf(UserError)
    expect(error.message).toBe('Could not move the items (HTTP 400). Refresh and try again.')
    expect(publicIpcMessage(error)).toBe('Could not move the items (HTTP 400). Refresh and try again.')
  })
})
