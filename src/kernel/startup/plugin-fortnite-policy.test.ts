import { expect, it } from 'vitest'
import { PLUGIN_MCP_OPERATIONS } from '../../types/plugin-fortnite'
import { pluginManifestSchema } from './plugin-manifest'
import { getPluginMCPPolicy, pluginMCPCatalog } from './plugin-fortnite-policy'

it('provides a policy for every advertised operation and confirms every mutation', () => {
  expect(pluginMCPCatalog().map((entry) => entry.operation)).toEqual([...PLUGIN_MCP_OPERATIONS])
  for (const entry of pluginMCPCatalog()) expect(entry.confirmationRequired).toBe(entry.operation !== 'QueryProfile')
  expect(pluginMCPCatalog().find((entry) => entry.operation === 'AssignGadgetToLoadout')?.bodySchema).toMatchObject({
    type: 'object', additionalProperties: false, required: ['loadoutId', 'gadgetId', 'slotIndex'],
    properties: { slotIndex: { type: 'integer', minimum: 0, maximum: 1 } },
  })
})
it.each(['PurchaseCatalogEntry', 'RecycleItemBatch', 'DeleteAccount', 'GetAccessToken', '../QueryProfile', 'constructor', '__proto__'])('fails closed for %s', (operation) => {
  expect(() => getPluginMCPPolicy(operation)).toThrow('Unsupported')
})
it('rejects extra fields, credential injection, and invalid slot arrays', () => {
  expect(() => getPluginMCPPolicy('QueryProfile').body.parse({ headers: { Authorization: 'secret' } })).toThrow()
  expect(() => getPluginMCPPolicy('SetPinnedQuests').body.parse({ pinnedQuestIds: ['a'], accountId: 'other' })).toThrow()
  expect(() => getPluginMCPPolicy('StartExpedition').body.parse({ expeditionId: 'a', squadId: 'b', itemIds: ['x', 'y'], slotIndices: [0, 0] })).toThrow()
  expect(() => getPluginMCPPolicy('AssignWorkerToSquadBatch').body.parse({ characterIds: ['x'], squadIds: ['s'], slotIndices: [] })).toThrow()
})
it('validates bounded declarations and rejects unknown profiles and commands', () => {
  const manifest = { id: 'sample', name: 'Sample', fortnite: { profiles: ['campaign'], operations: ['QueryProfile'] } }
  expect(pluginManifestSchema.parse(manifest).fortnite).toEqual(manifest.fortnite)
  expect(() => pluginManifestSchema.parse({ ...manifest, fortnite: { profiles: ['account_security'], operations: ['QueryProfile'] } })).toThrow()
  expect(() => pluginManifestSchema.parse({ ...manifest, fortnite: { profiles: ['campaign'], operations: ['*'] } })).toThrow()
})
