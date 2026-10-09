import { expect, it } from 'vitest'
import { filterPluginCommandResponse, filterPluginLocker, filterPluginProfile, filterPluginSessions } from './plugin-profile-data'
const envelope = (profile: Record<string, unknown> = {}) => ({
  access_token: 'SECRET', notifications: [{ secret: 'SECRET' }], multiUpdate: [{ secret: 'SECRET' }],
  profileChanges: [{ changeType: 'fullProfileUpdate', profile: {
    accountId: 'selected', profileId: 'campaign', rvn: 5, commandRevision: 4,
    email: 'SECRET', externalAuths: { secret: 'SECRET' }, ...profile,
  } }],
})
it('returns game items and stats as Epic sent them, including fields Penny has no schema for', () => {
  const result = filterPluginProfile(envelope({
    items: {
      quest: { templateId: 'Quest:test', quantity: 1, attributes: { quest_state: 'Active', completion_kills: 25 } },
      schematic: { templateId: 'Schematic:sid_test', quantity: 1, attributes: { level: 50, refundable: false, alterations: ['Alteration:a'], future_field: { nested: [1] } } },
    },
    stats: { attributes: { level: 100, research_levels: { technology: 50 }, some_new_stat: 'kept' } },
  }), 'selected', 'campaign')
  expect(result.items.quest.attributes).toEqual({ quest_state: 'Active', completion_kills: 25 })
  expect(result.items.schematic.attributes).toEqual({ level: 50, refundable: false, alterations: ['Alteration:a'], future_field: { nested: [1] } })
  expect(result.stats.attributes).toEqual({ level: 100, research_levels: { technology: 50 }, some_new_stat: 'kept' })
  expect(result).toMatchObject({ accountId: 'selected', profileId: 'campaign', rvn: 5, commandRevision: 4, filtered: true })
})
it('drops account secrets, purchase history and gift senders at every depth', () => {
  const result = filterPluginProfile(envelope({
    items: {
      cosmetic: { templateId: 'AthenaCharacter:cid_test', quantity: 1, attributes: {
        giftFromAccountId: 'SECRET', sessionId: 'SECRET',
        variants: [{ channel: 'Parts', active: 'Default', access_token: 'SECRET' }],
      } },
      gift: { templateId: 'GiftBox:gb_test', quantity: 1, attributes: { fromAccountId: 'SECRET', params: { userMessage: 'SECRET' } } },
      receipt: { templateId: 'Receipt:SECRET', quantity: 1 },
    },
    stats: { attributes: { Email: 'SECRET', mfa_enabled: true, rmt_purchase_history: 'SECRET', research_levels: { technology: 50, Secret: 'SECRET' } } },
  }), 'selected', 'campaign')
  expect(JSON.stringify(result)).not.toContain('SECRET')
  expect(result.items.cosmetic.attributes.variants).toEqual([{ channel: 'Parts', active: 'Default' }])
  expect(result.items.gift.attributes).toEqual({ params: {} })
  expect(result.items.receipt).toBeUndefined()
  expect(result.stats.attributes).toEqual({ research_levels: { technology: 50 } })
})
it('exposes common-core balances and shop limits without commerce or account-security stats', () => {
  const result = filterPluginProfile(envelope({ profileId: 'common_core',
    items: { currency: { templateId: 'Currency:MtxPurchased', quantity: 100, attributes: { platform: 'EpicPC' } } },
    stats: { attributes: { in_app_purchases: { receipts: ['SECRET'] }, mtx_purchase_history: 'SECRET', mfa_enabled: true, ban_status: 'SECRET',
      gift_history: { sentTo: { friend: 'SECRET' } }, daily_purchases: { purchaseList: { offer: 1 } } } },
  }), 'selected', 'common_core')
  expect(result.items.currency).toEqual({ templateId: 'Currency:MtxPurchased', quantity: 100, attributes: { platform: 'EpicPC' } })
  expect(result.stats.attributes).toEqual({ daily_purchases: { purchaseList: { offer: 1 } } })
  expect(JSON.stringify(result)).not.toContain('SECRET')
})
it('rejects cross-account and cross-profile responses', () => {
  expect(() => filterPluginProfile(envelope({ accountId: 'someone-else' }), 'selected', 'campaign')).toThrow('match')
  expect(() => filterPluginProfile(envelope({ profileId: 'athena' }), 'selected', 'campaign')).toThrow('match')
})
it('ignores prototype keys and bounds profile item count', () => {
  const items = JSON.parse('{"__proto__":{"templateId":"Hero:test","quantity":1},"constructor":{"templateId":"Hero:test","quantity":1},"ok":{"templateId":"Hero:test","quantity":1,"attributes":{"__proto__":{"polluted":true}}}}')
  const result = filterPluginProfile(envelope({ items }), 'selected', 'campaign')
  expect(Object.keys(result.items)).toEqual(['ok'])
  expect(Object.getPrototypeOf(result.items.ok.attributes)).toBe(Object.prototype)
  expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  expect(() => filterPluginProfile(envelope({ items: Object.fromEntries(Array.from({ length: 50_001 }, (_, i) => [String(i), {}])) }), 'selected', 'campaign')).toThrow('large')
})
it('returns a command reply with notifications but without transport fields or secrets', () => {
  const result = filterPluginCommandResponse({
    access_token: 'SECRET', profileRevision: 9, profileCommandRevision: 3,
    notifications: [{ type: 'terminalCommandResult', rewardGranted: true, email: 'SECRET' }],
    profileChanges: [{ changeType: 'itemAttrChanged', itemId: 'gift', attributeName: 'fromAccountId', attributeValue: 'SECRET' },
      { changeType: 'itemQuantityChanged', itemId: 'gold', quantity: 5 }],
    multiUpdate: [{ profileId: 'common_core', profileChanges: [{ changeType: 'statModified', name: 'gift_history', value: 'SECRET' },
      { changeType: 'statModified', name: 'daily_purchases', value: { offer: 1 } }] }],
  })
  expect(result).toEqual({ profileRevision: 9, profileCommandRevision: 3, notifications: [{ type: 'terminalCommandResult', rewardGranted: true }],
    profileChanges: [{ changeType: 'itemQuantityChanged', itemId: 'gold', quantity: 5 }],
    multiUpdate: [{ profileId: 'common_core', profileChanges: [{ changeType: 'statModified', name: 'daily_purchases', value: { offer: 1 } }] }] })
})
it('bounds session lookups and redacts them', () => {
  expect(filterPluginSessions(Array.from({ length: 30 }, () => ({ id: 's', refresh_token: 'SECRET' })))).toEqual(Array.from({ length: 20 }, () => ({ id: 's' })))
  expect(filterPluginSessions({ not: 'a list' })).toEqual([])
})
it('returns EOS slots without raw customizations, metadata or identity fields', () => {
  const result = filterPluginLocker({ access_token: 'SECRET', accountId: 'SECRET', activeLoadoutGroup: { loadouts: {
    'CosmeticLoadout:LoadoutSchema_Character': { shuffleType: 'DISABLED', secret: 'SECRET', loadoutSlots: [
      { slotTemplate: 'Character', equippedItemId: 'AthenaCharacter:cid_test', itemCustomizations: [{ secret: 'SECRET' }] },
    ] }, 'private:SECRET': { secret: 'SECRET' },
  } } })
  expect(result.activeLoadoutGroup.loadouts).toHaveProperty('CosmeticLoadout:LoadoutSchema_Character')
  expect(JSON.stringify(result)).not.toContain('SECRET')
})
