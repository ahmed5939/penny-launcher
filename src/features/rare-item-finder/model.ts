import legacyDictionary from './data/legacy-perks.json'
import currentDictionary from './data/current-perks.json'
import defenderDictionary from './data/defender-perks.json'
import aoePerks from './data/aoe-perks.json'
import itemNames from './data/item-names.json'
import bundledMetadata from './data/item-metadata.json'
import confirmedModdedData from './data/confirmed-modded.json'
import { auditSlots, resolvedItemId, ruleItemId } from './slot-audit'
import { RULES_VERSION, SOURCES } from './sources'
import type {
  Classification,
  FinderCounts,
  FinderError,
  FinderItem,
  FinderMetadata,
  FinderPerk,
  FinderSourceId,
  ScannedProfile,
  SlotRules,
} from './types'

const legacy = new Map(Object.entries(legacyDictionary as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]))
const current = new Map(Object.entries(currentDictionary as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]))
const defenders = defenderDictionary as Record<string, string>
const names = itemNames as Record<string, string>
const aoeIds = new Set((aoePerks as Array<string>).map((id) => id.toLowerCase()))
const confirmedModded = confirmedModdedData.signatures as Array<{ itemTemplateId: string; perks: Array<string | null> }>

/** Bundled PegLeg snapshot, used when the live item database has no record. */
export const fallback = bundledMetadata as unknown as FinderMetadata

export { SOURCES, RULES_VERSION }

const rarityCodes: Record<string, string> = { c: 'common', uc: 'uncommon', r: 'rare', vr: 'epic', sr: 'legendary', ur: 'mythic' }
const plainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown) => (typeof v === 'string' ? v : '')
const finite = <T>(v: unknown, otherwise: T): number | T => (typeof v === 'number' && Number.isFinite(v) ? v : otherwise)

type RawProfileItem = { templateId?: unknown; quantity?: unknown; attributes?: unknown }

/**
 * Accepts only a full-profile snapshot for the requested account and profile.
 * Delta-only responses, mismatches and missing item maps are errors, never an
 * empty inventory.
 */
export function extractProfile(response: unknown, sourceId: FinderSourceId, accountId: string) {
  const data = plainObject(response) ? (plainObject(response.data) ? response.data : response) : null
  if (data?.errorCode || data?.errorMessage) {
    // Keep the code for `safeError`'s lock/auth checks; drop Epic's own message.
    throw new FinderFailure('Epic rejected the profile request.', text(data.errorCode))
  }
  if (!Array.isArray(data?.profileChanges)) throw new FinderFailure('Epic did not return a full profile. Refresh to retry.')
  const change = data.profileChanges.find(
    (c: unknown) => plainObject(c) && c.changeType === 'fullProfileUpdate' && plainObject(c.profile),
  ) as { profile: Record<string, unknown> } | undefined
  if (!change) throw new FinderFailure('Epic returned only profile changes, not a full inventory. Refresh to retry.')
  const p = change.profile
  if (p.profileId && p.profileId !== sourceId) throw new FinderFailure('Epic returned a different inventory profile.')
  if (p.accountId && p.accountId !== accountId) throw new FinderFailure('Epic returned a different account.')
  if (!plainObject(p.items)) throw new FinderFailure('This profile has no valid item map. Refresh to retry.')
  return {
    items: p.items as Record<string, unknown>,
    revision: finite(p.rvn, finite(data.profileRevision, -1)),
  }
}

/** Weapon or trap for this inventory, or null for anything the finder does not read. */
export function kindOf(templateId: unknown, sourceId: string): 'weapon' | 'trap' | null {
  const id = text(templateId).toLowerCase()
  const source = SOURCES.find((s) => s.id === sourceId)
  if (!source) return null
  if (source.schematic) {
    if (!id.startsWith('schematic:') || /(?:^|[:_])(ingredient|ammo|consumable)(?:_|$)/.test(id)) return null
    return /(?:sid_|schematic:)(?:trap|floor|ceiling|wall)|_trap_|schematic:tid_/.test(id) ? 'trap' : 'weapon'
  }
  if (id.startsWith('trap:')) return 'trap'
  if (/^(weapon|rangedweapon|meleeweapon):/.test(id)) return 'weapon'
  return null
}

function recordFor(templateId: string, records: FinderMetadata['records']) {
  const id = templateId.toLowerCase()
  const schematic = id.replace(/^(weapon|rangedweapon|meleeweapon):wid_/, 'schematic:sid_')
  return records[id] ?? fallback.records[id] ?? records[schematic] ?? fallback.records[schematic] ?? null
}

export function prettify(id: string) {
  return id
    .replace(/^[^:]+:/, '')
    .replace(/^(sid|wid|tid|aid)_/, '')
    .replace(/_(ur|sr|vr|uc|r|c)_t\d+.*$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (x) => x.toUpperCase())
}

/**
 * Names every perk on a copy and decides legacy / modern / review from the
 * dictionaries alone. Slot rules refine this in `normalizeItem`.
 */
export function classify(attributes: unknown, records: FinderMetadata['records'] = {}): Classification {
  const a = plainObject(attributes) ? attributes : {}
  const values: Array<FinderPerk> = []
  const primaryIds = new Set(
    Array.isArray(a.alterations)
      ? a.alterations.filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase())
      : [],
  )
  let malformed = !plainObject(attributes)
  for (const field of ['alterations', 'alterationDefinitions']) {
    if (a[field] !== undefined && !Array.isArray(a[field])) malformed = true
    const entries = Array.isArray(a[field]) ? (a[field] as Array<unknown>) : []
    for (const [slot, value] of entries.entries()) {
      if (value === null || value === '') continue
      if (typeof value !== 'string' || !value.trim()) {
        malformed = true
        continue
      }
      const id = value.toLowerCase()
      // Preserve repeated slots. Only collapse the same perk mirrored in the other field.
      if (field === 'alterationDefinitions' && primaryIds.has(id)) {
        for (const existing of values.filter((p) => p.id.toLowerCase() === id)) {
          if (!existing.fields.includes(field)) existing.fields.push(field)
        }
        continue
      }
      const record = records[id] ?? fallback.records[id]
      const isDefender = Object.hasOwn(defenders, id)
      values.push({
        id: value,
        slot,
        name: defenders[id] ?? legacy.get(id) ?? current.get(id) ?? record?.name ?? prettify(value),
        legacy: legacy.has(id),
        modern: current.has(id) && !legacy.has(id) && !isDefender,
        defender: isDefender,
        aoe: aoeIds.has(id),
        known: legacy.has(id) || current.has(id) || isDefender || Boolean(record),
        fields: [field],
      })
    }
  }
  const matches = values.filter((p) => p.legacy)
  const reviewReasons: Array<string> = []
  if (a.refund_legacy_item === true) reviewReasons.push('Epic refund_legacy_item flag')
  if (a.legacy_item === true) reviewReasons.push('Epic legacy_item flag')
  if (values.some((p) => !p.known)) reviewReasons.push('Perk absent from the current item dictionary')
  if (malformed) reviewReasons.push('Missing or malformed perk attributes')
  return {
    status: matches.length ? 'legacy' : reviewReasons.length ? 'review' : 'modern',
    perks: values,
    reasons: matches.map((p) => p.name),
    reviewReasons,
  }
}

export function normalizeItem(
  accountId: string,
  sourceId: FinderSourceId,
  itemId: string,
  raw: RawProfileItem,
  rules: SlotRules,
  metadata: FinderMetadata = fallback,
): FinderItem | null {
  const kind = kindOf(raw?.templateId, sourceId)
  if (!kind) return null
  const templateId = raw.templateId as string
  const records = metadata?.records ?? {}
  const record = recordFor(templateId, records)
  const a = plainObject(raw.attributes) ? raw.attributes : {}
  const code = /_(ur|sr|vr|uc|r|c)(?:_|$)/i.exec(templateId)?.[1]?.toLowerCase()
  const rarity = ((code && rarityCodes[code]) ?? text(record?.rarity).toLowerCase()) || 'unknown'
  const tier = finite(a.tier, finite(record?.tier, Number(/_t(\d+)/i.exec(templateId)?.[1] ?? 0)))
  const level = finite(a.level, 1)
  const ratings = metadata?.ratings?.Default?.Tiers ?? fallback.ratings?.Default?.Tiers ?? {}
  const row = code ? ratings[`${code.toUpperCase()}_T${String(tier).padStart(2, '0')}`] : undefined
  const power = row ? finite(row.Ratings?.[level - row.FirstLevel], null) : null
  const imageName = text(record?.image)
  const image = imageName && !/[\\/]/.test(imageName) ? imageName : null
  const classification = classify(raw.attributes, records)
  const slotAudit = auditSlots(templateId, plainObject(raw.attributes) ? raw.attributes : null, classification.status === 'legacy', rules)
  const resolvedId = resolvedItemId(templateId)
  const perkArray = a.alterations ?? a.alterationDefinitions
  const moddedConfirmed =
    slotAudit.candidate &&
    Array.isArray(perkArray) &&
    confirmedModded.some(
      (signature) =>
        signature.itemTemplateId === (rules.schematicToItem[resolvedId] || resolvedId) &&
        JSON.stringify(signature.perks) ===
          JSON.stringify(perkArray.map((p) => (typeof p === 'string' ? p.trim().toLowerCase() || null : p))),
    )
  if (classification.status !== 'legacy' && slotAudit.status === 'matches_current_rules') {
    classification.reviewReasons = classification.reviewReasons.filter(
      (reason) => !/^Epic (refund_legacy_item|legacy_item) flag$/.test(reason),
    )
    if (!classification.reviewReasons.length) classification.status = 'modern'
  }
  if (classification.status !== 'legacy' && slotAudit.status !== 'matches_current_rules') {
    classification.status = 'review'
    classification.reviewReasons.push(...slotAudit.findings.map((f) => f.message))
  }
  const extracted = rules.items[ruleItemId(templateId, rules)]
  const historical = slotAudit.findings.some((f) => f.code === 'historical_perk' || f.code === 'historical_slot_unverified')
  const defenderPerk = slotAudit.findings.some((f) => f.code === 'defender_on_schematic')
  if (classification.status !== 'legacy') {
    if (moddedConfirmed || defenderPerk) classification.status = 'modded'
    else if (
      historical &&
      !slotAudit.candidate &&
      (slotAudit.status === 'historical_perk' || slotAudit.status === 'historical_review')
    ) {
      classification.status = 'historical'
    }
  }
  return {
    key: `${accountId}/${sourceId}/${itemId}`,
    accountId,
    sourceId,
    itemId,
    templateId,
    kind,
    name: extracted?.name?.trim() || names[templateId.toLowerCase()] || record?.name || prettify(templateId),
    description: text(record?.description),
    rarity,
    tier,
    level,
    power,
    quantity: finite(raw.quantity, 1),
    favorite: a.favorite === true,
    image,
    metadataMissing: !record,
    ...classification,
    slotAudit,
    modded: slotAudit.candidate,
    moddedConfirmed,
    defenderPerk,
    hybrid: classification.perks.some((p) => p.legacy) && classification.perks.some((p) => p.modern),
    historical,
    aoe: kind === 'weapon' && classification.perks.some((p) => p.aoe),
  }
}

export function normalizeProfile(
  accountId: string,
  sourceId: FinderSourceId,
  response: unknown,
  rules: SlotRules,
  metadata: FinderMetadata = fallback,
): ScannedProfile {
  const profile = extractProfile(response, sourceId, accountId)
  const items: Array<FinderItem> = []
  let malformedItems = 0
  for (const [id, raw] of Object.entries(profile.items)) {
    if (!plainObject(raw) || typeof raw.templateId !== 'string') {
      malformedItems++
      continue
    }
    const item = normalizeItem(accountId, sourceId, id, raw, rules, metadata)
    if (item) items.push(item)
  }
  return {
    sourceId,
    status: 'success',
    items,
    revision: profile.revision,
    rawCount: Object.keys(profile.items).length,
    scannedCount: items.length,
    malformedItems,
    scannedAt: new Date().toISOString(),
    error: null,
  }
}

export function counts(profiles: Array<Pick<ScannedProfile, 'status' | 'items' | 'malformedItems'>>): FinderCounts {
  const items = profiles.filter((p) => p.status === 'success').flatMap((p) => p.items)
  return {
    legacy: items.filter((i) => i.status === 'legacy').length,
    aoe: items.filter((i) => i.aoe).length,
    modded: items.filter((i) => i.modded).length,
    hybrid: items.filter((i) => i.hybrid).length,
    historical: items.filter((i) => i.historical && !i.modded).length,
    review: items.filter((i) => i.status === 'review').length,
    favorite: items.filter((i) => i.status === 'legacy' && i.favorite).length,
    eligible: items.filter((i) => i.sourceId === 'campaign' && i.status === 'legacy' && !i.favorite).length,
    scanned: items.length,
    complete:
      profiles.length === SOURCES.length && profiles.every((p) => p.status === 'success' && !p.malformedItems),
  }
}

/**
 * Turns any failure into a short, safe message. Service bodies, tokens and
 * transport configs never reach the renderer.
 */
export function safeError(error: unknown): FinderError {
  const e = (error ?? {}) as { code?: unknown; status?: unknown; message?: unknown; response?: { status?: unknown; data?: { errorCode?: unknown } } }
  const rawCode = e.response?.data?.errorCode ?? e.code ?? ''
  const code = typeof rawCode === 'string' && /^[a-zA-Z0-9_.-]{1,150}$/.test(rawCode) ? rawCode : ''
  const status = e.response?.status ?? e.status
  if (status === 401 || /authentication|token|unauthorized/i.test(code)) return { message: 'Sign in again through Penny, then refresh.', code }
  if (status === 429) return { message: 'Epic is rate limiting requests. Wait a moment, then refresh.', code: code || 'RATE_LIMITED' }
  if (/lock/i.test(code)) return { message: 'Epic has locked this inventory while it is in use. Return to the lobby, then retry.', code }
  if (error instanceof FinderFailure) return { message: error.message, code }
  if (status === 403) return { message: 'Epic refused access to this operation for this profile.', code }
  if (typeof status === 'number') return { message: `Epic request failed (HTTP ${status}). Refresh to retry.`, code }
  return { message: 'The request could not be completed. Refresh to retry.', code }
}

/** A failure whose message was written for the user and is safe to show. */
export class FinderFailure extends Error {
  code: string
  constructor(message: string, code = 'FINDER_ERROR') {
    super(message)
    this.code = code
  }
}
