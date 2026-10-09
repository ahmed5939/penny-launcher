import { llamaRewards } from '../automation-rewards/model'
import { protectedIds, type Items, type Reward } from '../expeditions/model'

/**
 * Open Llamas: opening card packs the account already owns.
 *
 * Everything that decides *which* packs may be opened or *which* rewards may
 * be recycled lives here, pure, so the renderer's preview and the main
 * process's run plan from the same code and the tests can pin both.
 *
 * The one rule that matters above the rest: a llama type the user excluded is
 * never submitted. Selection is by exact template id (display names collide),
 * the pool is frozen from the preview when Open is pressed, and the run
 * re-checks every GUID against that frozen whitelist before each request.
 */

/** One inventory GUID holding unopened packs. A GUID may hold a stack. */
export type PackStack = {
  itemId: string
  templateId: string
  quantity: number
  /** Asks the player to pick a reward. Never opened here; the game has to. */
  choice: boolean
}

export type PackType = {
  templateId: string
  /** Every pack of this type, choice packs included. */
  quantity: number
  /** What can be opened here — `quantity` less any choice packs. */
  openable: number
  stacks: number
}

export type LlamaPreview = {
  accountId: string
  /** Names this inventory read; a run must quote it back. */
  previewId: string
  fetchedAt: string
  /** Every unopened pack on the account. */
  total: number
  /** Sorted by template id. */
  types: Array<PackType>
  /** Openable stacks in opening order (template id, then GUID). */
  stacks: Array<PackStack>
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/** Code-unit order, so the opening order never depends on the user's locale. */
function byCodeUnit(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

export function compareStacks(a: PackStack, b: PackStack) {
  return byCodeUnit(a.templateId, b.templateId) || byCodeUnit(a.itemId, b.itemId)
}

/**
 * Choice packs ("pick one of these heroes") carry their options on the item.
 * The id check catches the ones whose options are only filled in on open.
 */
export function isChoicePack(templateId: string, attributes?: Record<string, unknown>) {
  const options = attributes?.options
  return /choice/i.test(templateId) || (Array.isArray(options) && options.length > 0)
}

export function packQuantity(item: { quantity?: unknown }) {
  const quantity = item.quantity === undefined ? 1 : Number(item.quantity)
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0
}

/**
 * Every `CardPack:` GUID in a campaign inventory. Currencies, X-Ray tickets
 * and `AccountResource:` llama vouchers are not card packs and never appear.
 */
export function readPackStacks(items: Items): Array<PackStack> {
  return Object.entries(items)
    .filter(([, item]) => typeof item?.templateId === 'string' && item.templateId.startsWith('CardPack:'))
    .map(([itemId, item]) => ({
      itemId,
      templateId: item.templateId,
      quantity: packQuantity(item),
      choice: isChoicePack(item.templateId, item.attributes),
    }))
    .filter((stack) => stack.quantity > 0)
    .sort(compareStacks)
}

/** Every unopened pack on the account, of any type. */
export function countPacks(items: Items) {
  return readPackStacks(items).reduce((total, stack) => total + stack.quantity, 0)
}

export function buildPreview(accountId: string, previewId: string, items: Items, fetchedAt = new Date().toISOString()): LlamaPreview {
  const all = readPackStacks(items)
  const types = new Map<string, PackType>()

  all.forEach((stack) => {
    const type = types.get(stack.templateId) ?? { templateId: stack.templateId, quantity: 0, openable: 0, stacks: 0 }
    type.quantity += stack.quantity
    type.stacks += 1
    if (!stack.choice) type.openable += stack.quantity
    types.set(stack.templateId, type)
  })

  return {
    accountId,
    previewId,
    fetchedAt,
    total: all.reduce((total, stack) => total + stack.quantity, 0),
    types: [...types.values()].sort((a, b) => byCodeUnit(a.templateId, b.templateId)),
    stacks: all.filter((stack) => !stack.choice),
  }
}

// ---------------------------------------------------------------------------
// Selection and planning
// ---------------------------------------------------------------------------

/** Types the user may tick. A type made only of choice packs is not one. */
export function selectableTypes(preview: Pick<LlamaPreview, 'types'>) {
  return preview.types.filter((type) => type.openable > 0)
}

/**
 * The included types, from the set the user excluded. Selection is stored as
 * exclusions so every owned type starts included and filtering or paging the
 * list can never change a hidden type's state.
 */
export function includedTypeIds(preview: Pick<LlamaPreview, 'types'>, excluded: ReadonlySet<string>) {
  return selectableTypes(preview).map((type) => type.templateId).filter((templateId) => !excluded.has(templateId))
}

export function selectedPackCount(preview: Pick<LlamaPreview, 'types'>, included: ReadonlySet<string>) {
  return selectableTypes(preview).reduce((total, type) => total + (included.has(type.templateId) ? type.openable : 0), 0)
}

export type OpenCount = { ok: true; value: number | null } | { ok: false; message: string }

/**
 * "Number to open". Blank is every *selected* pack — never every pack on the
 * account. Anything else must be a whole number from 1 to what is selected.
 */
export function parseOpenCount(text: string, available: number): OpenCount {
  const trimmed = text.trim()

  if (available <= 0) return { ok: false, message: 'Select at least one llama type to open.' }
  if (trimmed === '') return { ok: true, value: null }
  if (!/^\d+$/.test(trimmed)) return { ok: false, message: 'Enter a whole number, or leave it blank to open every selected pack.' }

  const value = Number(trimmed)

  if (!Number.isSafeInteger(value) || value <= 0) return { ok: false, message: 'Enter a number above zero.' }
  if (value > available) {
    return { ok: false, message: `Only ${available.toLocaleString()} selected ${available === 1 ? 'pack is' : 'packs are'} available. Lower the number or include more types.` }
  }

  return { ok: true, value }
}

export type OpeningPlan = {
  /** What the user asked for: their number, or every selected pack. */
  target: number
  /** What the plan reaches. Short of `target` only when a stack would overshoot. */
  total: number
  stacks: Array<PackStack>
  perType: Record<string, number>
}

/**
 * Walks the included stacks in template-id, then GUID, order. A stack is
 * taken whole or not at all: Epic may consume a whole stack for one GUID, so
 * one that would carry the run past the user's number is skipped rather than
 * risked, and a later, smaller stack may fill the gap.
 */
export function planOpening(stacks: ReadonlyArray<PackStack>, requested: number | null): OpeningPlan {
  const ordered = [...stacks].sort(compareStacks)
  const target = requested ?? ordered.reduce((total, stack) => total + stack.quantity, 0)
  const picked: Array<PackStack> = []
  const perType: Record<string, number> = {}
  let remaining = target

  for (const stack of ordered) {
    if (remaining <= 0) break
    if (stack.quantity > remaining) continue
    picked.push(stack)
    perType[stack.templateId] = (perType[stack.templateId] ?? 0) + stack.quantity
    remaining -= stack.quantity
  }

  return { target, total: target - remaining, stacks: picked, perType }
}

export function shortfallMessage(plan: OpeningPlan) {
  return `Stacked packs open whole, so in opening order this reaches ${plan.total.toLocaleString()} of ${plan.target.toLocaleString()}. Enter ${plan.total.toLocaleString()} or another number.`
}

// ---------------------------------------------------------------------------
// Recycling choices and rarity
// ---------------------------------------------------------------------------

export const recycleChoices = [
  { value: 'none', label: 'No Auto Recycle', maxRank: 0 },
  { value: 'below-uncommon', label: 'Below Uncommon', maxRank: 1 },
  { value: 'below-rare', label: 'Below Rare', maxRank: 2 },
  { value: 'below-epic', label: 'Below Epic', maxRank: 3 },
  { value: 'below-legendary', label: 'Below Legendary', maxRank: 4 },
  { value: 'below-mythic', label: 'Below Mythic', maxRank: 5 },
] as const

export type RecycleChoice = (typeof recycleChoices)[number]['value']

export function isRecycleChoice(value: unknown): value is RecycleChoice {
  return recycleChoices.some((choice) => choice.value === value)
}

/** The highest rarity rank a choice recycles. Mythic (6) is never reached. */
export function recycleCeiling(choice: RecycleChoice) {
  return recycleChoices.find((entry) => entry.value === choice)?.maxRank ?? 0
}

const rankByToken: Record<string, number> = { c: 1, uc: 2, r: 3, vr: 4, sr: 5, ur: 6 }
const rankByName: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 }

/** The rarity token in a template id, or null when there is none or more than one. */
export function templateRarityRank(templateId: string) {
  const body = templateId.slice(templateId.indexOf(':') + 1).toLowerCase()
  const ranks = new Set([...body.matchAll(/(?:^|_)(c|uc|r|vr|sr|ur)(?=_|$)/g)].map((match) => rankByToken[match[1]]))

  return ranks.size === 1 ? [...ranks][0] : null
}

/**
 * The rarity an item may be recycled at, or null when it must be kept.
 *
 * The template id and the item database must agree. Without a database
 * record the id alone decides, except for `sr`: mythic heroes carry `sr` in
 * their ids too, so Legendary is only recycled when the database confirms it.
 */
export function recycleRarityRank(templateId: string, catalogRarity?: string | null) {
  const fromTemplate = templateRarityRank(templateId)

  if (fromTemplate === null) return null
  if (catalogRarity === undefined || catalogRarity === null || catalogRarity === '') {
    return fromTemplate >= rankByName.legendary ? null : fromTemplate
  }

  return rankByName[catalogRarity.toLowerCase()] === fromTemplate ? fromTemplate : null
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

/** XP, evolution materials, currencies: counted by Epic in units, not items. */
export function isResourceReward(templateId: string) {
  return /^(AccountResource|Currency|Ingredient):/i.test(templateId)
}

/**
 * What an `OpenCardPackBatch` reply says the packs gave: the loot listed in
 * its notifications, or failing that the items its profile changes added.
 */
export function openedRewards(body: unknown): Array<Reward> {
  const response = (body ?? {}) as { notifications?: unknown; profileChanges?: unknown }
  const listed = llamaRewards(response.notifications)
  const rewards = listed.length > 0 ? listed : addedItems(response.profileChanges)
  const seen = new Set<string>()

  // A GUID is one item however many notifications mention it.
  return rewards.filter((reward) => {
    if (!reward.itemId) return true
    if (seen.has(reward.itemId)) return false
    seen.add(reward.itemId)
    return true
  })
}

function addedItems(changes: unknown): Array<Reward> {
  if (!Array.isArray(changes)) return []

  return changes.flatMap((change) => {
    const item = change?.item
    const quantity = Number(item?.quantity ?? 1)

    return change?.changeType === 'itemAdded' && typeof change.itemId === 'string' && typeof item?.templateId === 'string' && Number.isFinite(quantity) && quantity > 0
      ? [{ templateId: item.templateId, quantity, itemId: change.itemId }]
      : []
  })
}

/** Item rewards, counted by quantity. Resources are left out on purpose. */
export function countItems(rewards: ReadonlyArray<Reward>) {
  return rewards.reduce((total, reward) => total + (isResourceReward(reward.templateId) ? 0 : reward.quantity), 0)
}

/** Heroes, defenders and survivors slotted anywhere in a hero loadout. */
function assignedIds(items: Items) {
  const ids = protectedIds(items)

  Object.values(items).forEach((item) => {
    if (!item.templateId.startsWith('CampaignHeroLoadout:')) return
    const attributes = item.attributes ?? {}
    ;[attributes.crew_members, attributes.defenders, attributes.defender_slots].forEach((slots) => {
      if (slots && typeof slots === 'object') {
        Object.values(slots).forEach((value) => {
          if (typeof value === 'string' && value.length > 0) ids.add(value)
        })
      }
    })
  })

  return ids
}

/**
 * Why an item may not be recycled whatever its rarity, or null. Errs towards
 * keeping: a false positive costs a recycle, a false negative costs an item.
 */
export function protectionReason(itemId: string, item: Items[string], assigned: ReadonlySet<string>) {
  const attributes = item.attributes ?? {}

  if (item.favorite || attributes.favorite || attributes.is_favorite) return 'favourite'
  if (
    assigned.has(itemId) ||
    (typeof attributes.squad_id === 'string' && attributes.squad_id.length > 0) ||
    (typeof attributes.squad_slot_idx === 'number' && attributes.squad_slot_idx >= 0) ||
    Number(attributes.building_slot_used) >= 0 ||
    (attributes.loadout_index !== undefined && attributes.loadout_index !== null)
  ) {
    return 'assigned'
  }
  if (/quest/i.test(item.templateId) || Object.entries(attributes).some(([key, value]) => /quest|lock|protect/i.test(key) && Boolean(value))) {
    return 'quest'
  }

  return null
}

const recyclableCategory = /^(Hero|Schematic|Worker|Defender):/i

/**
 * The rewards from one opening request that may be recycled under `choice`.
 *
 * Only GUIDs the opening reply named, absent from the inventory before the
 * request and before the run, and present now with the same template and
 * quantity. `after` must be read after opening and immediately before the
 * recycle request, so favourites or assignments made meanwhile are seen.
 * This is separate from the Auto Llamas/Expeditions helper, which stops at
 * Epic; only this operation can recycle Legendary.
 */
export function openingRecycleTargets(
  rewards: ReadonlyArray<Reward>,
  {
    after,
    before,
    catalogRarity,
    choice,
    preRun,
  }: {
    after: Items
    before: Items
    catalogRarity?: (templateId: string) => string | null | undefined
    choice: RecycleChoice
    preRun: ReadonlySet<string>
  }
): Array<Reward & { itemId: string }> {
  const ceiling = recycleCeiling(choice)

  if (ceiling <= 0) return []

  const assigned = assignedIds(after)
  const seen = new Set<string>()

  return rewards.filter((reward): reward is Reward & { itemId: string } => {
    const id = reward.itemId

    if (!id || seen.has(id) || Object.hasOwn(before, id) || preRun.has(id)) return false
    seen.add(id)

    const item = after[id]

    if (!item || item.templateId !== reward.templateId || !recyclableCategory.test(item.templateId)) return false
    if (packQuantity(item) !== reward.quantity) return false
    if (protectionReason(id, item, assigned) !== null) return false

    const rank = recycleRarityRank(item.templateId, catalogRarity?.(item.templateId))

    return rank !== null && rank <= ceiling
  })
}

// ---------------------------------------------------------------------------
// The run request
// ---------------------------------------------------------------------------

export type OpenLlamasRequest = {
  accountId: string
  previewId: string
  templateIds: Array<string>
  count: number | null
  recycle: RecycleChoice
}

export type FrozenRun = {
  accountId: string
  previewId: string
  /** The whitelist. Nothing whose template is not in here is ever submitted. */
  included: ReadonlySet<string>
  /** Every eligible GUID from the preview, frozen. */
  pool: ReadonlyArray<Readonly<PackStack>>
  plan: Readonly<OpeningPlan>
  recycle: RecycleChoice
}

/**
 * Checks a run request against the preview it quotes and freezes what it may
 * open. Rejects rather than repairs: an empty or unknown selection never
 * falls back to "everything", and a number the selection cannot meet is
 * never met by adding other types.
 */
export function freezeRun(preview: LlamaPreview, request: unknown): { ok: true; run: FrozenRun } | { ok: false; error: string } {
  const value = (request ?? {}) as Partial<Record<keyof OpenLlamasRequest, unknown>>

  if (typeof value.accountId !== 'string' || value.accountId !== preview.accountId) {
    return { ok: false, error: 'This preview belongs to another account. Refresh and try again.' }
  }
  if (value.previewId !== preview.previewId) {
    return { ok: false, error: 'This preview is out of date. Refresh and check the selection again.' }
  }
  if (!Array.isArray(value.templateIds) || value.templateIds.length === 0) {
    return { ok: false, error: 'Choose at least one llama type to open.' }
  }

  const known = new Set(selectableTypes(preview).map((type) => type.templateId))
  const templateIds = value.templateIds as Array<unknown>

  if (
    templateIds.some((templateId) => typeof templateId !== 'string' || !known.has(templateId)) ||
    new Set(templateIds).size !== templateIds.length
  ) {
    return { ok: false, error: 'The selection includes a llama type this account cannot open here. Refresh and choose again.' }
  }
  if (!isRecycleChoice(value.recycle)) {
    return { ok: false, error: 'Choose an Auto Recycle setting.' }
  }

  const included: ReadonlySet<string> = Object.freeze(new Set(templateIds as Array<string>))
  const pool = Object.freeze(
    preview.stacks
      .filter((stack) => !stack.choice && included.has(stack.templateId))
      .map((stack) => Object.freeze({ ...stack }))
      .sort(compareStacks)
  )
  const available = pool.reduce((total, stack) => total + stack.quantity, 0)
  const count = value.count

  if (count !== null && count !== undefined && (typeof count !== 'number' || !Number.isSafeInteger(count) || count <= 0 || count > available)) {
    return { ok: false, error: `Enter a number from 1 to ${available.toLocaleString()}, or leave it blank.` }
  }

  const plan = planOpening(pool, typeof count === 'number' ? count : null)

  if (plan.total !== plan.target || plan.total <= 0) {
    return { ok: false, error: plan.total <= 0 ? 'Choose at least one llama type to open.' : shortfallMessage(plan) }
  }

  return {
    ok: true,
    run: {
      accountId: preview.accountId,
      previewId: preview.previewId,
      included,
      pool,
      plan: Object.freeze({ ...plan, stacks: Object.freeze([...plan.stacks]) as Array<PackStack>, perType: Object.freeze({ ...plan.perType }) }),
      recycle: value.recycle,
    },
  }
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type RunStatus = 'waiting' | 'running' | 'done' | 'stopped' | 'cancelled' | 'failed'

export type OpenLlamasProgress = {
  accountId: string
  status: RunStatus
  /** Packs this run set out to open, from included types only. */
  target: number
  /** Confirmed by inventory, never by request count. */
  opened: number
  /** Confirmed removed by inventory. */
  recycled: number
  /** Item rewards confirmed received and not recycled. */
  kept: number
  /** Every unopened pack left on the account, excluded types included. */
  packsLeft: number | null
  recycle: RecycleChoice
  /** Why the run ended early, when it did. */
  message: string | null
  /** A request that may or may not have taken effect. Never folded into the totals. */
  uncertain: string | null
  cancelRequested: boolean
}

export function isRunActive(progress: Pick<OpenLlamasProgress, 'status'> | null | undefined) {
  return progress?.status === 'waiting' || progress?.status === 'running'
}
