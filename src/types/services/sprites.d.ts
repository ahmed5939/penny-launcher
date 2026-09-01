/**
 * The two backend documents behind the sprite collection.
 *
 * Everything is optional on purpose: both are undocumented game-client
 * payloads that change with the season, and a missing field should cost one
 * sprite its detail, not fail the whole page.
 */

/**
 * `getBackendCatalog` — every relic the module knows, keyed by relic id
 * (`Water_Variant_Gold`, `Klombo_Variant_CheatMaster`, …).
 *
 * `Currency_ExtractionPoints` is in the same map: the points spent to summon
 * a relic are themselves a relic-shaped entry.
 */
export type SpriteCatalogEntry = {
  _private?: boolean
  templateId?: string
  attributes?: {
    bIsStarter?: boolean
    summonCost?: number
  }
}

export type SpriteCatalogResponse = Record<string, SpriteCatalogEntry>

/**
 * One module of the account's magpie inventory.
 *
 * `counts` is relic id → how many the account holds (plus the points
 * balance under `Currency_ExtractionPoints`); `entitlementMetadata` is relic
 * id → a JSON *string* of `{ xp, ml }`; `metadata` is a JSON string of the
 * module's own state, which is where the equipped relic is recorded.
 */
export type SpriteInventoryModule = {
  moduleId?: string
  counts?: Record<string, number>
  entitlementMetadata?: Record<string, string>
  metadata?: string
  metadataSchemaVersion?: number
  purchasedEntitlementConsequentialToGameplay?: boolean
}

export type SpriteInventoryResponse = {
  accountId?: string
  deploymentId?: string
  domain?: string
  inventory?: Array<SpriteInventoryModule>
  linkMode?: string
  workspace?: string
}

/** What `entitlementMetadata[relicId]` decodes to. */
export type SpriteEntitlement = {
  xp?: number
  /** Mastery level — non-zero once the relic has been levelled to the top. */
  ml?: number | boolean
}

/** What a module's `metadata` decodes to. */
export type SpriteModuleMetadata = {
  StarterRelic?: string
  EquippedVariant?: string
}
