import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
import { PluginBridge, PluginLifecycle, PluginStorage } from './plugin-api'
import { pluginManifestSchema } from './plugin-manifest'

const directories: string[] = []
afterEach(async () => {
  vi.useRealTimers()
  PluginBridge.clearAll()
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})
async function storage() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'penny-plugin-'))
  directories.push(dir)
  return { dir, store: new PluginStorage(dir) }
}

describe('plugin storage', () => {
  it('preserves concurrent writes and isolates returned values', async () => {
    const { dir, store } = await storage()
    await Promise.all([store.set('a', { count: 1 }), store.set('b', 2)])
    const value = await store.get('a') as { count: number }
    value.count = 9
    expect(await store.get('a')).toEqual({ count: 1 })
    expect(JSON.parse(await readFile(path.join(dir, 'storage.json'), 'utf8'))).toEqual({ a: { count: 1 }, b: 2 })
  })
  it('handles prototype keys as data and excludes inherited keys', async () => {
    const { store } = await storage()
    expect(await store.get('toString', 'missing')).toBe('missing')
    await store.set('__proto__', { safe: true })
    expect(await store.get('__proto__')).toEqual({ safe: true })
  })
  it('rejects oversized writes without poisoning the queue', async () => {
    const { store } = await storage()
    await expect(store.set('large', 'x'.repeat(1024 * 1024))).rejects.toThrow('1 MiB')
    await store.set('ok', 1)
    expect(await store.all()).toEqual({ ok: 1 })
  })
  it('reports disk failures, retains committed state and allows retry', async () => {
    const { dir, store } = await storage()
    await store.set('value', 1)
    await mkdir(path.join(dir, 'storage.json.tmp'))
    await expect(store.set('value', 2)).rejects.toThrow()
    expect(await store.get('value')).toBe(1)
    await rm(path.join(dir, 'storage.json.tmp'), { recursive: true })
    await store.set('value', 3)
    expect(await store.get('value')).toBe(3)
  })
  it('surfaces corrupt data instead of silently overwriting it', async () => {
    const { dir, store } = await storage()
    await writeFile(path.join(dir, 'storage.json'), '{broken')
    await expect(store.set('a', 1)).rejects.toThrow()
    expect(await readFile(path.join(dir, 'storage.json'), 'utf8')).toBe('{broken')
  })
})

describe('plugin lifecycle and events', () => {
  it('cancels timers and cleans up in reverse order despite failures', async () => {
    vi.useFakeTimers()
    const lifecycle = new PluginLifecycle()
    const ticks = vi.fn()
    const order: number[] = []
    lifecycle.interval(ticks, 1000)
    lifecycle.add(() => { order.push(1) })
    lifecycle.add(() => { order.push(2); throw new Error('cleanup') })
    await vi.advanceTimersByTimeAsync(1000)
    expect(ticks).toHaveBeenCalledTimes(1)
    await lifecycle.dispose()
    await lifecycle.dispose()
    await vi.advanceTimersByTimeAsync(2000)
    expect(order).toEqual([2, 1])
    expect(ticks).toHaveBeenCalledTimes(1)
    expect(lifecycle.signal.aborted).toBe(true)
  })
  it('does not share mutable event payloads across plugins', () => {
    PluginBridge.on('first', 'account-scope-changed', (payload) => {
      (payload as { members: string[] }).members.push('injected')
    })
    const listener = vi.fn()
    PluginBridge.on('second', 'account-scope-changed', listener)
    PluginBridge.setAccountScope({ primary: null, members: ['real'] })
    expect(listener).toHaveBeenCalledWith({ primary: null, members: ['real'] })
  })
})

describe('plugin manifest validation', () => {
  it.each([
    { entry: '../outside.js' }, { entry: 'C:\\outside.js' },
    { repository: 'javascript:alert(1)' }, { repository: 'https://user:pass@example.com' },
    { apiVersion: -1 }, { apiVersion: 1.5 }, { capabilities: ['unknown'] },
    { name: ' ' }, { id: 'con' },
  ])('rejects invalid manifest fields: %j', (fields) => {
    expect(pluginManifestSchema.safeParse({ id: 'sample', name: 'Sample', ...fields }).success).toBe(false)
  })
  it('accepts legacy manifests and deduplicates declarations', () => {
    expect(pluginManifestSchema.parse({ id: 'sample', name: 'Sample' }).id).toBe('sample')
    expect(pluginManifestSchema.parse({ id: 'sample', name: 'Sample', capabilities: ['network', 'network'] }).capabilities).toEqual(['network'])
  })
})
