import type { RatingTables } from '../../config/constants/fortnite/power'

/** The four inventories the finder reads, in scan order. */
export type FinderSourceId =
  | 'campaign'
  | 'collection_book_schematics0'
  | 'theater0'
  | 'outpost0'

export type FinderSource = {
  id: FinderSourceId
  label: string
  short: string
  /** Schematics carry `alterations`; crafted copies carry `alterationDefinitions`. */
  schematic: boolean
}

/**
 * Extracted 42.10 slot rules. The file is ~20MB, so it ships as an extra
 * resource and is loaded by the main process only while a scan runs.
 */
export type SlotRule = {
  index: number
  unlockLevel: number
  unlockRarity: string
  allowed: Array<string>
}

export type SlotRuleItem = {
  name: string
  rarity: string
  category: string
  coverage: 'resolved' | 'unresolved'
  slots: Array<SlotRule>
}

export type SlotRules = {
  metadata: Record<string, unknown>
  /** Lower-case `schematic:sid_…` → lower-case `weapon:wid_…` / `trap:tid_…`. */
  schematicToItem: Record<string, string>
  knownPerks: Array<string>
  items: Record<string, SlotRuleItem>
}

/** The subset of an item-database record the finder reads; the bundled snapshot has the same shape. */
export type FinderRecord = {
  name?: string | null
  description?: string | null
  rarity?: string | null
  tier?: number | null
  /** `ExportedImages` file name, resolved through `peglegImageURL`. */
  image?: string | null
}

export type FinderMetadata = {
  records: Record<string, FinderRecord>
  ratings?: RatingTables
}

export type SlotFinding = {
  code:
    | 'defender_on_schematic'
    | 'historical'
    | 'unknown_template'
    | 'malformed'
    | 'conflicting_fields'
    | 'extra_slots'
    | 'unknown_perk'
    | 'historical_slot_unverified'
    | 'historical_perk'
    | 'disallowed_slot'
    | 'missing_slot'
  message: string
  slot?: number
  perkId?: string
  field?: string
  exceptionId?: string
}

export type SlotAuditStatus =
  | 'matches_current_rules'
  | 'outside_current_rules'
  | 'historical_review'
  | 'historical_perk'
  | 'incomplete'
  | 'unknown'

export type SlotAudit = {
  status: SlotAuditStatus
  findings: Array<SlotFinding>
  build: string
  /** Outside the current rules and not otherwise explained — a modded candidate. */
  candidate: boolean
}

export type FinderPerk = {
  id: string
  slot: number
  name: string
  legacy: boolean
  modern: boolean
  defender: boolean
  aoe: boolean
  known: boolean
  fields: Array<string>
}

export type ItemStatus = 'legacy' | 'review' | 'modern' | 'modded' | 'historical'

export type Classification = {
  status: ItemStatus
  perks: Array<FinderPerk>
  reasons: Array<string>
  reviewReasons: Array<string>
}

export type FinderItem = Classification & {
  /** `${accountId}/${sourceId}/${itemId}` — identical templates in two places stay two copies. */
  key: string
  accountId: string
  sourceId: FinderSourceId
  itemId: string
  templateId: string
  kind: 'weapon' | 'trap'
  name: string
  description: string
  rarity: string
  tier: number
  level: number
  power: number | null
  quantity: number
  favorite: boolean
  /** `ExportedImages` file name or null. */
  image: string | null
  metadataMissing: boolean
  slotAudit: SlotAudit
  modded: boolean
  moddedConfirmed: boolean
  defenderPerk: boolean
  hybrid: boolean
  historical: boolean
  aoe: boolean
}

export type FinderError = { message: string; code: string }

export type ScannedProfile = {
  sourceId: FinderSourceId
  status: 'success' | 'error'
  items: Array<FinderItem>
  error: FinderError | null
  revision?: number
  rawCount?: number
  scannedCount?: number
  malformedItems?: number
  scannedAt?: string
}

export type FinderCounts = {
  legacy: number
  aoe: number
  modded: number
  hybrid: number
  historical: number
  review: number
  favorite: number
  eligible: number
  scanned: number
  /** Every inventory read cleanly; anything less is shown as a partial scan. */
  complete: boolean
}

export type RareItemScan = {
  accountId: string
  fetchedAt: string
  profiles: Array<ScannedProfile>
  counts: FinderCounts
  rulesVersion: string
}
