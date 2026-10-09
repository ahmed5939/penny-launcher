import { expect, it } from 'vitest'
import { PLUGIN_MCP_CONFIRMED_OPERATIONS, pluginCommandNeedsDialog } from '../../types/plugin-fortnite'
import { pluginManifestSchema } from './plugin-manifest'
import { getPluginMCPPolicy, pluginMCPCatalog } from './plugin-fortnite-policy'

it('describes known operations and flags the ones that always ask', () => {
  const catalog = pluginMCPCatalog()
  expect(catalog.find((entry) => entry.operation === 'AssignGadgetToLoadout')?.bodySchema).toMatchObject({
    type: 'object', additionalProperties: true, required: ['loadoutId', 'gadgetId', 'slotIndex'],
    properties: { slotIndex: { type: 'integer', minimum: 0, maximum: 1 } },
  })
  expect(catalog.find((entry) => entry.operation === 'DisassembleWorldItems')).toMatchObject({ profiles: ['theater0', 'theater1', 'theater2'], bodySchema: { type: 'object', additionalProperties: true } })
  expect(catalog.find((entry) => entry.operation === 'ExecuteTerminalCommand')?.profiles).toEqual(['athena'])
  expect(catalog.filter((entry) => entry.alwaysConfirmed).map((entry) => entry.operation)).toEqual([...PLUGIN_MCP_CONFIRMED_OPERATIONS])
  expect(catalog.find((entry) => entry.operation === 'QueryProfile')?.permission).toBe('fortnite:profiles')
})
it('accepts any well-formed operation name and rejects paths, URLs and prototype keys', () => {
  expect(getPluginMCPPolicy('SomeFutureCommand')).toMatchObject({ write: true, known: false, profiles: expect.arrayContaining(['theater2', 'metadata']) })
  for (const operation of ['../QueryProfile', 'https://evil.test', 'constructor', '__proto__', 'Query Profile', 'A', '']) {
    expect(() => getPluginMCPPolicy(operation)).toThrow('Unsupported')
  }
})
it('checks the fields it knows and passes the rest through', () => {
  expect(getPluginMCPPolicy('SetPinnedQuests').body.parse({ pinnedQuestIds: ['a'], client_request_id: 'x' })).toEqual({ pinnedQuestIds: ['a'], client_request_id: 'x' })
  expect(() => getPluginMCPPolicy('SetPinnedQuests').body.parse({ pinnedQuestIds: 'a' })).toThrow()
  expect(() => getPluginMCPPolicy('StartExpedition').body.parse({ expeditionId: 'a', squadId: 'b', itemIds: ['x', 'y'], slotIndices: [0, 0] })).toThrow()
  expect(() => getPluginMCPPolicy('AssignWorkerToSquadBatch').body.parse({ characterIds: ['x'], squadIds: ['s'], slotIndices: [] })).toThrow()
  expect(() => getPluginMCPPolicy('QueryProfile').body.parse({ headers: { Authorization: 'secret' } })).toThrow()
  expect(() => getPluginMCPPolicy('SomeFutureCommand').body.parse({ blob: 'x'.repeat(70_000) })).toThrow('64 KiB')
  expect(() => getPluginMCPPolicy('SomeFutureCommand').body.parse({ big: 1n })).toThrow()
})
it('asks per call before API v6, and for money and gifts always', () => {
  expect(pluginCommandNeedsDialog('SetPinnedQuests', 5)).toBe(true)
  expect(pluginCommandNeedsDialog('SetPinnedQuests', undefined)).toBe(true)
  expect(pluginCommandNeedsDialog('SetPinnedQuests', 6)).toBe(false)
  expect(pluginCommandNeedsDialog('PurchaseCatalogEntry', 6)).toBe(true)
})
it('validates bounded declarations and rejects unknown profiles and wildcard commands', () => {
  const manifest = { id: 'sample', name: 'Sample', fortnite: { profiles: ['campaign', 'theater2'], operations: ['QueryProfile', 'ModifyQuickbar'] } }
  expect(pluginManifestSchema.parse(manifest).fortnite).toEqual(manifest.fortnite)
  expect(() => pluginManifestSchema.parse({ ...manifest, fortnite: { profiles: ['account_security'], operations: ['QueryProfile'] } })).toThrow()
  expect(() => pluginManifestSchema.parse({ ...manifest, fortnite: { profiles: ['campaign'], operations: ['*'] } })).toThrow()
  expect(() => pluginManifestSchema.parse({ ...manifest, permissions: ['fortnite:sessions', 'fortnite:presence'] })).not.toThrow()
})
