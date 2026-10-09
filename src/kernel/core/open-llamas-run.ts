import type { Items, Reward } from '../../features/expeditions/model'
import type { FrozenRun, LlamaPreview, OpenLlamasProgress, PackStack, RunStatus } from '../../features/open-llamas/model'

import {
  countItems,
  countPacks,
  freezeRun,
  isResourceReward,
  openedRewards,
  openingRecycleTargets,
  packQuantity,
  recycleCeiling,
} from '../../features/open-llamas/model'

/**
 * Executes one Open Llamas run. No Electron and no endpoints in here — the
 * caller hands in a client — so the tests drive it with a fake Epic and read
 * the exact request bodies it sent.
 *
 * Invariants, each enforced here and not only in the UI:
 * - Only GUIDs from the preview, of a template on the frozen whitelist, are
 *   ever submitted. Re-checked against the live inventory before each request.
 * - The pool never grows: excluded types, packs acquired since the preview
 *   and rewards that happen to be packs are never added.
 * - Totals are what the inventory confirms, not what was asked for.
 * - A state-changing request is never retried. If its outcome is unknown the
 *   run stops and says so, apart from the totals.
 */

/** Bot parity choices, not Epic limits. */
export const OPEN_BATCH_SIZE = 25
export const RECYCLE_BATCH_SIZE = 100

export type OpenLlamasClient = {
  /** The campaign profile's items. */
  queryProfile: () => Promise<Items>
  /** `OpenCardPackBatch` with `{ cardPackItemIds }`; resolves to Epic's reply body. */
  openCardPacks: (cardPackItemIds: Array<string>) => Promise<unknown>
  /** `RecycleItemBatch` with `{ targetItemIds }`. */
  recycleItems: (targetItemIds: Array<string>) => Promise<unknown>
}

/** Thrown by a client before anything was sent, e.g. a sign-in that failed. */
export class RequestNotSentError extends Error {
  readonly notSent = true
}

export type RunInput = {
  preview: LlamaPreview
  request: unknown
  client: OpenLlamasClient
  onProgress: (progress: OpenLlamasProgress) => void
  /** Checked before each opening request. */
  isCancelled?: () => boolean
  /** Item database rarity by template id. */
  catalogRarity?: (templateId: string) => string | null | undefined
  limits?: { openBatch?: number; recycleBatch?: number }
}

type Outcome = 'rejected' | 'unknown'

/** Epic answered with a refusal (nothing changed), or we cannot know. */
function outcomeOf(error: unknown): Outcome {
  if ((error as { notSent?: unknown })?.notSent === true) return 'rejected'
  const status = (error as { response?: { status?: unknown } })?.response?.status

  return typeof status === 'number' && status >= 400 && status < 500 ? 'rejected' : 'unknown'
}

/** Epic's own words, if it gave any. Never the request, its headers or token. */
function reasonOf(error: unknown) {
  const data = (error as { response?: { data?: { errorMessage?: unknown; errorCode?: unknown } } })?.response?.data
  const status = (error as { response?: { status?: unknown } })?.response?.status
  const text = typeof data?.errorMessage === 'string' ? data.errorMessage : typeof data?.errorCode === 'string' ? data.errorCode : null

  if (status === 429) return ' (Epic is rate-limiting requests — wait a minute)'
  if (text) return ` (${text.slice(0, 160)})`
  if (typeof status === 'number') return ` (HTTP ${status})`
  if (error instanceof RequestNotSentError) return ` (${error.message})`

  return ''
}

/**
 * Any eligible GUID that is not what this run expects: gone, a different
 * type, or a different quantity. Packs of excluded types are not looked at.
 */
function poolDrift(expected: ReadonlyMap<string, { templateId: string; quantity: number }>, items: Items, included: ReadonlySet<string>) {
  for (const [itemId, pack] of expected) {
    const item = Object.hasOwn(items, itemId) ? items[itemId] : undefined

    if (pack.quantity <= 0) {
      if (item) return 'A pack this run had already opened is back in the inventory.'
      continue
    }
    if (!item) return 'A selected pack is no longer in the inventory.'
    if (item.templateId !== pack.templateId || !included.has(item.templateId)) return 'A selected pack changed type.'
    if (packQuantity(item) !== pack.quantity) return 'The number of packs in a selected stack changed.'
  }

  return null
}

/** How many packs each submitted GUID lost between two inventory reads. */
function consumption(batch: ReadonlyArray<{ itemId: string; templateId: string }>, before: Items, after: Items) {
  const perGuid = new Map<string, number>()
  let total = 0

  for (const { itemId, templateId } of batch) {
    const had = packQuantity(before[itemId] ?? {})
    const now = Object.hasOwn(after, itemId) ? after[itemId] : undefined

    if (now && now.templateId !== templateId) return { error: 'A pack changed type while it was being opened.' as const }

    const used = had - (now ? packQuantity(now) : 0)

    if (used < 0) return { error: 'A pack stack grew while it was being opened.' as const }
    perGuid.set(itemId, used)
    total += used
  }

  return { perGuid, total }
}

/** Sum of the reward quantities whose GUIDs are gone from `items`. */
function removedQuantity(rewards: ReadonlyArray<Reward & { itemId: string }>, items: Items) {
  return rewards.reduce((total, reward) => total + (Object.hasOwn(items, reward.itemId) ? 0 : reward.quantity), 0)
}

export async function runOpenLlamas(input: RunInput): Promise<OpenLlamasProgress> {
  const { client, onProgress } = input
  const openBatch = Math.max(1, input.limits?.openBatch ?? OPEN_BATCH_SIZE)
  const recycleBatch = Math.max(1, input.limits?.recycleBatch ?? RECYCLE_BATCH_SIZE)
  const progress: OpenLlamasProgress = {
    accountId: input.preview.accountId,
    status: 'running',
    target: 0,
    opened: 0,
    recycled: 0,
    kept: 0,
    packsLeft: input.preview.total,
    recycle: 'none',
    message: null,
    uncertain: null,
    cancelRequested: false,
  }
  const publish = () => onProgress({ ...progress })
  // Every run ends here, so every run — including a rejected one — publishes a final summary.
  const finish = (status: RunStatus, message: string | null, uncertain?: string) => {
    progress.status = status
    progress.message = message
    if (uncertain) progress.uncertain = uncertain
    publish()
    return { ...progress }
  }

  const frozen = freezeRun(input.preview, input.request)

  if (!frozen.ok) return finish('failed', frozen.error)

  const run: FrozenRun = frozen.run
  const ceiling = recycleCeiling(run.recycle)

  progress.target = run.plan.target
  progress.recycle = run.recycle
  publish()

  /** What every eligible GUID should hold. Only this run's own opening changes it. */
  const expected = new Map(run.pool.map((stack) => [stack.itemId, { templateId: stack.templateId, quantity: stack.quantity }]))
  /** The planned GUIDs, in opening order. Nothing else is ever submitted. */
  const planned: ReadonlyArray<Readonly<PackStack>> = run.plan.stacks

  let items: Items

  try {
    items = await client.queryProfile()
  } catch {
    return finish('failed', 'Could not refresh the inventory from Epic. Nothing was opened — try again.')
  }

  if (poolDrift(expected, items, run.included)) {
    return finish('stopped', 'Your llamas changed since the preview. Nothing was opened — refresh and check the selection.')
  }

  const preRun = new Set(Object.keys(items))
  let remaining = run.plan.target

  progress.packsLeft = countPacks(items)

  while (remaining > 0) {
    if (input.isCancelled?.()) {
      progress.cancelRequested = true
      return finish('cancelled', null)
    }

    // The next planned GUIDs still holding packs. A stack is only submitted
    // when everything it could consume fits in what is left to open.
    const batch: Array<{ itemId: string; templateId: string; quantity: number }> = []
    let possible = 0

    for (const stack of planned) {
      const holds = expected.get(stack.itemId)?.quantity ?? 0

      if (holds <= 0 || holds > remaining - possible) continue
      if (batch.length >= openBatch || (batch.length > 0 && possible + holds > openBatch)) break
      batch.push({ itemId: stack.itemId, templateId: stack.templateId, quantity: holds })
      possible += holds
    }

    if (batch.length === 0) {
      return finish('stopped', `The selected packs cannot cover the remaining ${remaining.toLocaleString()} without opening more than you asked for. Refresh and try again.`)
    }

    const drift = poolDrift(expected, items, run.included)

    if (drift) return finish('stopped', `${drift} It changed outside this run, so it stopped before opening more. Refresh before trying again.`)

    // The whitelist, once more, at the point of no return.
    for (const pack of batch) {
      const frozenPack = expected.get(pack.itemId)
      const live = items[pack.itemId]

      if (!frozenPack || frozenPack.templateId !== pack.templateId || !run.included.has(pack.templateId) || live?.templateId !== pack.templateId) {
        return finish('failed', 'A pack outside the selection was about to be opened, so the run stopped. Please report this.')
      }
    }

    let reply: unknown

    try {
      reply = await client.openCardPacks(batch.map((pack) => pack.itemId))
    } catch (error) {
      const outcome = outcomeOf(error)
      const said = outcome === 'rejected' ? `Epic refused the last request${reasonOf(error)}.` : `The last request failed without a clear answer from Epic${reasonOf(error)}.`

      try {
        const after = await client.queryProfile()
        const used = consumption(batch, items, after)

        progress.packsLeft = countPacks(after)
        if ('error' in used) return finish('stopped', `${said} ${used.error} Refresh before trying again.`)
        progress.opened += used.total

        return finish(
          'stopped',
          `${said} No automatic retry was made — refresh before opening more.`,
          used.total > 0 ? `The last request opened ${used.total.toLocaleString()} ${used.total === 1 ? 'pack' : 'packs'}, but their rewards could not be read, so they are not in the item totals and were not recycled.` : undefined
        )
      } catch {
        return finish(
          'stopped',
          `${said} No automatic retry was made — refresh before opening more.`,
          outcome === 'unknown' ? `The last request (up to ${possible.toLocaleString()} packs) may have gone through. It is not in the totals; refresh to check.` : undefined
        )
      }
    }

    let after: Items

    try {
      after = await client.queryProfile()
    } catch {
      return finish(
        'stopped',
        'Epic accepted the last request, but the inventory could not be read to confirm it.',
        `Up to ${possible.toLocaleString()} packs from the last request were probably opened. They are not in the totals and nothing from them was recycled.`
      )
    }

    const used = consumption(batch, items, after)

    progress.packsLeft = countPacks(after)
    if ('error' in used) return finish('stopped', `${used.error} Refresh before trying again.`)

    progress.opened += used.total
    remaining -= used.total
    used.perGuid.forEach((count, itemId) => {
      const pack = expected.get(itemId)
      if (pack) pack.quantity -= count
    })

    if (used.total === 0) {
      return finish('stopped', 'Epic accepted the request but no packs were opened. Refresh before trying again.')
    }

    const rewards = openedRewards(reply)
    const itemRewards = rewards.filter((reward) => !isResourceReward(reward.templateId))

    if (rewards.length === 0) {
      return finish(
        'stopped',
        'Epic did not list what the last packs contained, so the run stopped rather than guess.',
        `${used.total.toLocaleString()} opened ${used.total === 1 ? 'pack is' : 'packs are'} counted, but their rewards are not in the item totals and were not recycled.`
      )
    }

    let latest = after
    let recycled = 0

    if (ceiling > 0) {
      // `after` was read after opening and is the latest view of each reward's
      // favourite/assignment state before the recycle request goes out.
      const targets = openingRecycleTargets(itemRewards, { after, before: items, catalogRarity: input.catalogRarity, choice: run.recycle, preRun })

      for (let index = 0; index < targets.length; index += recycleBatch) {
        const chunk = targets.slice(index, index + recycleBatch)
        const chunkQuantity = chunk.reduce((total, reward) => total + reward.quantity, 0)
        const settle = (status: RunStatus, message: string, uncertainQuantity = 0, uncertain?: string) => {
          progress.recycled += recycled
          progress.kept += countItems(itemRewards) - recycled - uncertainQuantity
          return finish(status, message, uncertain)
        }

        try {
          await client.recycleItems(chunk.map((reward) => reward.itemId))
        } catch (error) {
          const outcome = outcomeOf(error)
          const said = outcome === 'rejected' ? `Epic refused to recycle${reasonOf(error)}.` : `Recycling failed without a clear answer from Epic${reasonOf(error)}.`

          try {
            const check = await client.queryProfile()

            recycled += removedQuantity(chunk, check)
            progress.packsLeft = countPacks(check)
            return settle('stopped', `${said} No automatic retry was made — refresh before opening more.`)
          } catch {
            return settle(
              'stopped',
              `${said} No automatic retry was made — refresh before opening more.`,
              chunkQuantity,
              `${chunkQuantity.toLocaleString()} ${chunkQuantity === 1 ? 'item' : 'items'} in the last recycling request may or may not have been recycled. They are in neither total.`
            )
          }
        }

        let check: Items

        try {
          check = await client.queryProfile()
        } catch {
          return settle(
            'stopped',
            'Epic accepted the last recycling request, but the inventory could not be read to confirm it.',
            chunkQuantity,
            `${chunkQuantity.toLocaleString()} ${chunkQuantity === 1 ? 'item was' : 'items were'} probably recycled. They are in neither total.`
          )
        }

        const removed = removedQuantity(chunk, check)

        recycled += removed
        latest = check
        progress.packsLeft = countPacks(check)

        if (removed !== chunkQuantity) {
          return settle('stopped', 'Epic did not recycle everything it was asked to. What is still in the inventory is counted as kept; refresh before opening more.')
        }
      }
    }

    progress.recycled += recycled
    progress.kept += countItems(itemRewards) - recycled
    items = latest
    publish()
  }

  return finish('done', null)
}
