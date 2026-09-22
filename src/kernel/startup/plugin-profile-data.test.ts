import { expect, it } from 'vitest'
import { filterPluginLocker, filterPluginProfile } from './plugin-profile-data'
const envelope = (profile: Record<string, unknown> = {}) => ({
  access_token: 'SECRET', notifications: [{ secret: 'SECRET' }], multiUpdate: [{ secret: 'SECRET' }],
  profileChanges: [{ changeType: 'fullProfileUpdate', profile: {
    accountId: 'selected', profileId: 'campaign', rvn: 5, commandRevision: 4,
    email: 'SECRET', externalAuths: { secret: 'SECRET' }, ...profile,
  } }],
})
it('keeps game items, objective progress and supported stats in their original shape', () => {
  const result = filterPluginProfile(envelope({
    items: { quest: { templateId: 'Quest:test', quantity: 1, attributes: { quest_state: 'Active', completion_kills: 25 } } },
    stats: { attributes: { level: 100, research_levels: { technology: 50 }, quest_manager: { dailyQuestRerolls: 1 } } },
  }), 'selected', 'campaign')
  expect(result.items.quest.attributes).toEqual({ quest_state: 'Active', completion_kills: 25 })
  expect(result.stats.attributes).toMatchObject({ level: 100, research_levels: { technology: 50 } })
  expect(result.filtered).toBe(true)
})
it('drops sensitive and unknown fields at every nested boundary', () => {
  const result = filterPluginProfile(envelope({
    items: {
      cosmetic: { templateId: 'AthenaCharacter:cid_test', quantity: 1, secret: 'SECRET', attributes: {
        giftFromAccountId: 'SECRET', accountId: 'SECRET', sessionId: 'SECRET', future_unknown: 'SECRET',
        variants: [{ channel: 'Parts', active: 'Default', access_token: 'SECRET' }],
      } },
      receipt: { templateId: 'Receipt:SECRET', quantity: 1 },
    },
    stats: { attributes: { email: 'SECRET', mfa_enabled: true, rmt_purchase_history: 'SECRET',
      research_levels: { technology: 50, secret: 'SECRET' },
      quest_manager: { dailyQuestRerolls: 1, sessionId: 'SECRET', questPoolStats: { poolStats: [{ poolName: 'daily', secret: 'SECRET' }] } },
    } },
  }), 'selected', 'campaign')
  expect(JSON.stringify(result)).not.toContain('SECRET')
  expect(result.items.cosmetic.attributes.variants).toEqual([{ channel: 'Parts', active: 'Default' }])
  expect(result.items.receipt).toBeUndefined()
})
it('exposes common-core item balances without any account, gift or commerce stats', () => {
  const result = filterPluginProfile(envelope({ profileId: 'common_core',
    items: { currency: { templateId: 'Currency:MtxPurchased', quantity: 100, attributes: { platform: 'SECRET' } } },
    stats: { attributes: { in_app_purchases: { receipts: ['SECRET'] }, mfa_enabled: true, gift_history: 'SECRET', level: 5 } },
  }), 'selected', 'common_core')
  expect(result.items.currency.quantity).toBe(100)
  expect(result.stats.attributes).toEqual({})
  expect(JSON.stringify(result)).not.toContain('SECRET')
})
it('rejects cross-account and cross-profile responses', () => {
  expect(() => filterPluginProfile(envelope({ accountId: 'someone-else' }), 'selected', 'campaign')).toThrow('match')
  expect(() => filterPluginProfile(envelope({ profileId: 'athena' }), 'selected', 'campaign')).toThrow('match')
})
it('does not turn arbitrary nested objective values into a raw data channel', () => {
  const result = filterPluginProfile(envelope({ items: {
    quest: { templateId: 'Quest:test', quantity: 1, attributes: { completion_test: { secret: 'SECRET' }, completion_other: 'SECRET', level: 'SECRET' } },
  } }), 'selected', 'campaign')
  expect(result.items.quest.attributes).toEqual({})
})
it('ignores prototype keys and bounds profile item count', () => {
  const items = JSON.parse('{"__proto__":{"templateId":"Hero:test","quantity":1},"constructor":{"templateId":"Hero:test","quantity":1}}')
  expect(Object.keys(filterPluginProfile(envelope({ items }), 'selected', 'campaign').items)).toEqual([])
  expect(() => filterPluginProfile(envelope({ items: Object.fromEntries(Array.from({ length: 30_001 }, (_, i) => [String(i), {}])) }), 'selected', 'campaign')).toThrow('large')
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
