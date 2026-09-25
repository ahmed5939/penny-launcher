import { Box } from 'lucide-react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const account = vi.hoisted(() => ({ id: 'alice' as string | null }))
vi.mock('../../hooks/accounts', () => ({
  useGetSelectedAccount: () => ({ selected: account.id ? { accountId: account.id } : undefined }),
}))

import {
  ACCOUNT_RESOURCE_CACHE_LIMIT,
  AccountResourceGate,
  type AccountResource,
  accountResourceCacheId,
  accountResourceCacheSize,
  clearAccountResourceCache,
  emptyResourceState,
  peekAccountResourceCache,
  resourceLoadFailed,
  resourceLoadStarted,
  resourceLoadSucceeded,
  subscribeToRefreshEvent,
  useAccountResource,
  writeAccountResourceCache,
} from './account-resource'

const never = () => new Promise<string>(() => undefined)

function Probe({ cacheKey, deps }: { cacheKey?: string; deps?: Array<string> }) {
  const resource = useAccountResource(never, { cacheKey, deps })
  return createElement('p', null, `data=${resource.data ?? 'none'} loading=${resource.loading} updated=${resource.updatedAt ?? 'none'}`)
}
const render = (props: { cacheKey?: string; deps?: Array<string> } = {}) => renderToStaticMarkup(createElement(Probe, props))

beforeEach(() => {
  account.id = 'alice'
  clearAccountResourceCache()
})

describe('account resource cache', () => {
  it('shows cached data on the first render and still marks it loading', () => {
    writeAccountResourceCache(accountResourceCacheId('backpack', 'alice'), 'alice', 'alice-bag', 1000)
    expect(render({ cacheKey: 'backpack' })).toContain('data=alice-bag loading=true updated=1000')
  })

  it('ignores the cache without a cacheKey', () => {
    writeAccountResourceCache(accountResourceCacheId('backpack', 'alice'), 'alice', 'alice-bag', 1000)
    expect(render()).toContain('data=none loading=true')
  })

  it('never serves one account’s data under another', () => {
    writeAccountResourceCache(accountResourceCacheId('backpack', 'alice'), 'alice', 'alice-bag', 1000)
    account.id = 'bob'
    expect(render({ cacheKey: 'backpack' })).toContain('data=none')
    // Even a colliding id is refused when the stored owner differs.
    expect(peekAccountResourceCache(accountResourceCacheId('backpack', 'alice'), 'bob')).toBeUndefined()
  })

  it('keys on deps', () => {
    writeAccountResourceCache(accountResourceCacheId('storage', 'alice', ['backpack']), 'alice', 'bag', 1)
    expect(render({ cacheKey: 'storage', deps: ['storage'] })).toContain('data=none')
    expect(render({ cacheKey: 'storage', deps: ['backpack'] })).toContain('data=bag')
  })

  it('evicts the least recently written entry past the limit', () => {
    for (let index = 0; index <= ACCOUNT_RESOURCE_CACHE_LIMIT; index++) {
      writeAccountResourceCache(`k${index}`, 'alice', index, index)
    }
    expect(accountResourceCacheSize()).toBe(ACCOUNT_RESOURCE_CACHE_LIMIT)
    expect(peekAccountResourceCache('k0', 'alice')).toBeUndefined()
    expect(peekAccountResourceCache(`k${ACCOUNT_RESOURCE_CACHE_LIMIT}`, 'alice')?.data).toBe(ACCOUNT_RESOURCE_CACHE_LIMIT)
  })

  it('clears one account without touching the others', () => {
    writeAccountResourceCache('a', 'alice', 1, 1)
    writeAccountResourceCache('b', 'bob', 2, 2)
    clearAccountResourceCache('alice')
    expect(peekAccountResourceCache('a', 'alice')).toBeUndefined()
    expect(peekAccountResourceCache('b', 'bob')?.data).toBe(2)
  })
})

describe('account resource state', () => {
  it('keeps data through a failed refresh and reports the error', () => {
    const loaded = resourceLoadSucceeded('alice', 'bag', 1000)
    const refreshing = resourceLoadStarted(loaded, 'alice')
    expect(refreshing).toMatchObject({ data: 'bag', loading: true, error: null, updatedAt: 1000 })
    expect(resourceLoadFailed(refreshing, 'alice', 'HTTP 503')).toEqual({ key: 'alice', data: 'bag', error: 'HTTP 503', loading: false, updatedAt: 1000 })
  })

  it('does not carry data across keys', () => {
    const loaded = resourceLoadSucceeded('alice', 'bag', 1000)
    expect(resourceLoadStarted(loaded, 'bob').data).toBeNull()
    expect(resourceLoadFailed(loaded, 'bob', 'nope').data).toBeNull()
  })

  it('starts from the cached copy for a new key', () => {
    expect(resourceLoadStarted<string>(emptyResourceState, 'alice', { data: 'cached', updatedAt: 5 })).toMatchObject({ data: 'cached', loading: true, updatedAt: 5 })
  })
})

describe('AccountResourceGate', () => {
  const gate = (resource: Partial<AccountResource<string>>) =>
    renderToStaticMarkup(
      createElement(AccountResourceGate<string>, {
        children: (data) => createElement('main', null, `content:${data}`),
        icon: Box,
        resource: { accountId: 'alice', data: null, error: null, loading: false, refresh: () => undefined, ...resource },
        what: 'the backpack',
      })
    )

  it('shows data with a compact warning when a refresh failed', () => {
    const markup = gate({ data: 'bag', error: 'HTTP 503', updatedAt: new Date(2026, 0, 1, 14, 5).getTime() })
    expect(markup).toContain('content:bag')
    expect(markup).toContain('Couldn&#x27;t refresh — showing data from')
    expect(markup).toContain('HTTP 503')
    expect(markup).not.toContain('Could not load the backpack')
  })

  it('shows the error screen when there is no data', () => {
    const markup = gate({ error: 'HTTP 503' })
    expect(markup).toContain('Could not load the backpack')
    expect(markup).not.toContain('content:')
  })

  it('keeps content during a background refresh', () => {
    const markup = gate({ data: 'bag', loading: true })
    expect(markup).toContain('content:bag')
    expect(markup).not.toContain('role="alert"')
  })
})

describe('penny:refresh', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const fire = () => window.dispatchEvent(new Event('penny:refresh', { cancelable: true }))

  it('refreshes every mounted resource and cancels the fallback', () => {
    const one = vi.fn()
    const two = vi.fn()
    const offOne = subscribeToRefreshEvent(one)
    const offTwo = subscribeToRefreshEvent(two)
    expect(fire()).toBe(false)
    expect(one).toHaveBeenCalledTimes(1)
    expect(two).toHaveBeenCalledTimes(1)
    offOne()
    offTwo()
  })

  it('lets the router fallback run once nothing is mounted', () => {
    const refresh = vi.fn()
    subscribeToRefreshEvent(refresh)()
    expect(fire()).toBe(true)
    expect(refresh).not.toHaveBeenCalled()
  })
})
