import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ root: '', selection: '', starts: [] as string[], stops: 0 }))
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => mock.root }, shell: { openPath: vi.fn() }, dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [mock.selection] }) } }))
vi.mock('./data-directory', () => ({ DataDirectory: { getDataDirectoryPath: () => mock.root } }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: vi.fn() } }))
vi.mock('./plugin-broker', () => ({
  emptyPluginUI: () => ({ panels: [], settings: [], actions: [] }),
  pluginLog: vi.fn(), dispatchPlugin: vi.fn(), readPluginSettings: async () => ({}), savePluginSettings: vi.fn(),
}))
vi.mock('./plugin-sandbox', () => ({ PluginSandbox: class {
  canOpen = true
  async start(source: string) { mock.starts.push(source); if (source.includes('FAIL')) throw new Error('Activation failed') }
  async stop() { mock.stops++ }
  destroy() {}
  event() {}
  async command() {}
} }))
let manager: typeof import('./plugins').PluginManager
async function packageAt(directory: string, version = '1', extra: object = {}, source = 'module.exports = { activate() {} }') {
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'plugin.json'), JSON.stringify({ id: 'sample', name: 'Sample', runtime: 'sandbox', apiVersion: 4, version, permissions: ['storage'], ...extra }))
  await writeFile(path.join(directory, 'main.js'), source)
  await writeFile(path.join(directory, 'README.md'), 'Example')
}
beforeEach(async () => {
  vi.resetModules()
  mock.root = await mkdtemp(path.join(os.tmpdir(), 'penny-manager-'))
  mock.selection = path.join(mock.root, 'incoming')
  mock.starts = []; mock.stops = 0
  manager = (await import('./plugins')).PluginManager
})
afterEach(async () => { await manager.shutdown(); await rm(mock.root, { recursive: true, force: true }) })
async function install() {
  await packageAt(mock.selection)
  const result = await manager.review('import')
  expect(result.ok).toBe(true)
  expect(await manager.acceptReview(result.review!.token)).toEqual({ ok: true })
}
describe('reviewed plugin lifecycle', () => {
  it('never executes dropped-in code without a review', async () => {
    await packageAt(path.join(mock.root, 'plugins', 'sample'))
    expect((await manager.list())[0].status).toBe('review')
    expect(mock.starts).toEqual([])
    expect((await manager.install('sample')).ok).toBe(false)
    const review = await manager.review('installed', 'sample')
    expect((await manager.acceptReview(review.review!.token)).ok).toBe(true)
    expect((await manager.list())[0].status).toBe('running')
  })
  it('reviews snapshots, grants only on acceptance, and prevents token reuse', async () => {
    await packageAt(mock.selection)
    const { review } = await manager.review('import')
    expect(mock.starts).toEqual([])
    await writeFile(path.join(mock.selection, 'main.js'), 'FAIL')
    expect((await manager.acceptReview(review!.token)).ok).toBe(true)
    expect(mock.starts[0]).not.toContain('FAIL')
    expect((await manager.acceptReview(review!.token)).ok).toBe(false)
  })
  it('detects tampering with a reviewed snapshot', async () => {
    await packageAt(mock.selection)
    const { review } = await manager.review('import')
    await writeFile(path.join(mock.root, 'plugin-staging', review!.token, 'main.js'), 'changed')
    expect((await manager.acceptReview(review!.token)).ok).toBe(false)
    expect(mock.starts).toEqual([])
  })
  it('persists disable across restart and reload requires review for modified files', async () => {
    await install()
    expect((await manager.manage({ action: 'disable', id: 'sample' })).ok).toBe(true)
    await manager.shutdown()
    expect((await manager.list())[0].status).toBe('disabled')
    await writeFile(path.join(mock.root, 'plugins', 'sample', 'main.js'), 'changed')
    expect((await manager.manage({ action: 'reload', id: 'sample' })).ok).toBe(false)
    expect((await manager.list())[0].status).toBe('review')
    expect(mock.starts).toHaveLength(1)
  })
  it('stops all plugins in safe mode and preserves enabled choices', async () => {
    await install()
    await manager.manage({ action: 'safe-mode', enabled: true })
    expect((await manager.list())[0].status).toBe('disabled')
    expect((await manager.manage({ action: 'enable', id: 'sample' })).ok).toBe(false)
    await manager.shutdown()
    expect((await manager.mode()).safeMode).toBe(true)
    await manager.manage({ action: 'safe-mode', enabled: false })
    expect((await manager.list())[0].status).toBe('running')
  })
  it('shows new permissions and rolls back both code and grants after failed update', async () => {
    await install()
    await packageAt(mock.selection, '2', { permissions: ['storage', 'accounts:read'] }, 'FAIL')
    const { review } = await manager.review('import')
    expect(review!.addedPermissions).toEqual(['accounts:read'])
    expect((await manager.acceptReview(review!.token)).ok).toBe(false)
    expect((await manager.list())[0]).toMatchObject({ version: '1', status: 'running', permissions: ['storage'] })
    expect(await readFile(path.join(mock.root, 'plugins', 'sample', 'main.js'), 'utf8')).not.toContain('FAIL')
  })
  it('supports explicit rollback and preserves saved data when removed', async () => {
    await install()
    const storageFile = path.join(mock.root, 'plugin-data', 'sample', 'storage.json')
    await writeFile(storageFile, '{"kept":true}')
    await packageAt(mock.selection, '2')
    const { review } = await manager.review('import')
    await manager.acceptReview(review!.token)
    expect((await manager.list())[0]).toMatchObject({ version: '2', canRollback: true })
    expect((await manager.manage({ action: 'rollback', id: 'sample' })).ok).toBe(true)
    expect((await manager.list())[0].version).toBe('1')
    await manager.remove('sample')
    expect(await manager.list()).toEqual([])
    expect(await readFile(storageFile, 'utf8')).toBe('{"kept":true}')
  })
  it('refuses legacy code without executing it', async () => {
    await packageAt(mock.selection, '1', { runtime: undefined })
    expect((await manager.review('import')).ok).toBe(false)
    expect(mock.starts).toEqual([])
  })
})
