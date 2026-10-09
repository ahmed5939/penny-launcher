import { z } from 'zod'
import type { PluginFortniteProfile } from '../../types/plugin-fortnite'

const text = z.string().max(2048)
const maxItems = 50_000
const maxResultBytes = 16 * 1024 * 1024

/**
 * Account secrets, commerce history and other people's gift details. Matched
 * case-insensitively at any depth of profiles, command responses and sessions.
 * Everything else is game data and is returned as Epic sent it.
 */
const secretKeys = new Set([
  'email', 'externalAuths', 'access_token', 'accessToken', 'refresh_token', 'refreshToken',
  'device_id', 'deviceId', 'secret', 'password', 'sessionId', 'session_id',
  'in_app_purchases', 'mtx_purchase_history', 'rmt_purchase_history', 'receipts',
  'gift_history', 'fromAccountId', 'giftFromAccountId', 'toAccountId', 'userMessage',
  'ban_history', 'ban_status', 'mfa_enabled',
].map((key) => key.toLowerCase()))
const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype'])

function record(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
}
/** Profile changes name the stat or attribute in a value (`statModified`, `itemAttrChanged`), not a key. */
function secretChange(value: unknown) {
  const change = record(value)
  const name = change.name ?? change.attributeName
  return typeof change.changeType === 'string' && typeof name === 'string' && secretKeys.has(name.toLowerCase())
}
export function redactGameData(value: unknown, depth = 0): unknown {
  if (depth > 64) throw new Error('Game data is nested too deeply.')
  if (Array.isArray(value)) return value.filter((entry) => !secretChange(entry)).map((entry) => redactGameData(entry, depth + 1))
  if (value === null || typeof value !== 'object') return value
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (unsafeKeys.has(key) || secretKeys.has(key.toLowerCase())) continue
    // Purchase receipts can also arrive as profile items.
    if (typeof record(entry).templateId === 'string' && /^Receipt:/i.test(record(entry).templateId as string)) continue
    output[key] = redactGameData(entry, depth + 1)
  }
  return output
}
function bounded<T>(result: T, label: string) {
  if (Buffer.byteLength(JSON.stringify(result)) > maxResultBytes) throw new Error(`${label} exceeds 16 MiB.`)
  return result
}

export function filterPluginProfile(data: unknown, accountId: string, profileId: PluginFortniteProfile) {
  const envelope = record(data)
  if (!Array.isArray(envelope.profileChanges)) throw new Error('Missing game profile.')
  const update = envelope.profileChanges.slice(0, 100).map(record).find((change) =>
    change.changeType === 'fullProfileUpdate' && record(change.profile).profileId === profileId)
  const profile = record(update?.profile)
  if (profile.accountId !== accountId || profile.profileId !== profileId) throw new Error('Game profile does not match the selected account.')
  if (Object.keys(record(profile.items)).length > maxItems) throw new Error('Game profile is too large.')
  const redacted = record(redactGameData(profile))
  const items: Record<string, { templateId: string; quantity: number; attributes: Record<string, unknown> }> = {}
  for (const [itemId, raw] of Object.entries(record(redacted.items))) {
    const item = record(raw)
    if (typeof item.templateId !== 'string') continue
    items[itemId] = { ...item, templateId: item.templateId, quantity: typeof item.quantity === 'number' ? item.quantity : 1, attributes: record(item.attributes) }
  }
  const stats = record(redacted.stats)
  return bounded({ ...redacted, accountId, profileId, filtered: true as const, items, stats: { ...stats, attributes: record(stats.attributes) } }, 'Game profile')
}

/** A command's own reply: profile changes, notifications and multi-profile updates, minus secrets. */
export function filterPluginCommandResponse(data: unknown) {
  const envelope = record(data)
  const fields = ['profileRevision', 'profileId', 'profileChangesBaseRevision', 'profileChanges', 'profileCommandRevision', 'serverTime', 'responseVersion', 'notifications', 'multiUpdate']
  return bounded(record(redactGameData(Object.fromEntries(fields.filter((field) => Object.hasOwn(envelope, field)).map((field) => [field, envelope[field]])))), 'Command response')
}

/** Matchmaking sessions the account is currently in. */
export function filterPluginSessions(data: unknown) {
  return bounded((Array.isArray(data) ? data.slice(0, 20) : []).map((session) => record(redactGameData(session))), 'Session list')
}

export function filterPluginLocker(data: unknown) {
  const source = record(record(record(data).activeLoadoutGroup).loadouts)
  if (Object.keys(source).length > 100) throw new Error('Locker is too large.')
  const loadouts: Record<string, unknown> = Object.create(null)
  const schema = z.object({
    loadoutSlots: z.array(z.object({ slotTemplate: text, equippedItemId: text.optional() })).max(100).optional(),
    shuffleType: text.optional(),
  })
  for (const [key, value] of Object.entries(source)) {
    if (!/^CosmeticLoadout:[A-Za-z0-9_]{1,160}$/.test(key)) continue
    const parsed = schema.safeParse(value)
    if (parsed.success) loadouts[key] = parsed.data
  }
  return { activeLoadoutGroup: { loadouts }, filtered: true as const }
}
