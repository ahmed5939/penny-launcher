import { afterEach, describe, expect, it, vi } from 'vitest'

const accountId = 'a'.repeat(32)
const mocks = vi.hoisted(() => ({ verify: vi.fn(async () => 'test-only-token') }))
vi.mock('./authentication', () => ({ Authentication: { verifyAccessToken: mocks.verify } }))
vi.mock('../startup/accounts', () => ({ AccountsManager: { getAccounts: () => new Map([[accountId, { accountId }]]) } }))

import { UserError, publicIpcMessage } from '../user-error'
import { upgradeCollectionBookItem } from './collection-book'

const request = { itemId: 'hero-1', book: 'people', action: 'level', desiredLevel: 5 }
const epicError = 'errors.com.epicgames.fortnite.item_locked: Item is in use by C:\\Users\\ahmed'

describe('collection book upgrade errors', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not forward the error text Epic returns', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ errorCode: 'errors.com.epicgames.fortnite.item_locked', errorMessage: epicError }) })))

    const error = await upgradeCollectionBookItem(accountId, request).catch((failure: Error) => failure)

    expect(error).toBeInstanceOf(UserError)
    expect(error.message).toBe('Could not upgrade the item (HTTP 409). Refresh and try again.')
    expect(publicIpcMessage(error)).toBe('Could not upgrade the item (HTTP 409). Refresh and try again.')
  })
})
