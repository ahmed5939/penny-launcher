/**
 * Sprite fixtures for the preview harness: three accounts built from the
 * bundled sprite data, a sweep that lands one account at a time (the third
 * fails, to show the column warning), and a change log made by running the
 * real history model over a few earlier snapshots. Not shipped.
 */
import type { SpriteData } from '../src/kernel/core/sprite-collection'
import type { SpriteHistoryFile, SpriteSnapshot } from '../src/kernel/core/sprite-history-model'

import spriteData from '../src/data/sprites.json'
import { buildSpriteCollection } from '../src/kernel/core/sprite-collection'
import {
  buildHistoryPayload,
  catalogueStatus,
  emptySpriteHistory,
  recordSnapshot,
  snapshotFromCollection,
} from '../src/kernel/core/sprite-history-model'

type Emit = (channel: string, payload: any) => void

const data = spriteData as SpriteData
const relics = Object.entries(data.families).flatMap(([family, known]) =>
  Object.keys(known.icons).map((variant) => `${family}_Variant_${variant}`)
)

/** Stable pseudo-random in [0, 1) per account and relic. */
const roll = (seed: number, index: number) =>
  (((Math.imul(index + 1, 2654435761) ^ Math.imul(seed, 40503)) >>> 0) % 1000) / 1000

const costs = [100, 400, 900, 1500, 2700]
const catalog: Record<string, any> = Object.fromEntries(
  relics
    .filter((_, index) => index % 3 !== 2)
    .map((relicId, index) => [relicId, { attributes: { summonCost: costs[index % costs.length] } }])
)
// One the bundled data has never heard of, for the "unresolved" callout.
catalog.MossyFrogSprite_Variant_A = { attributes: { summonCost: 600 } }
catalog.Currency_ExtractionPoints = {}

type FixtureAccount = {
  accountId: string
  displayName: string
  seed: number
  owned: number
  lost: number
  dust: number | null
  equipped: string | null
  error?: string
}

function inventory(account: FixtureAccount) {
  const counts: Record<string, number> = {}
  const entitlementMetadata: Record<string, string> = {}

  relics.forEach((relicId, index) => {
    const r = roll(account.seed, index)

    if (r < account.owned) {
      counts[relicId] = 2
      entitlementMetadata[relicId] = JSON.stringify(
        r < account.owned * 0.2 ? { xp: 12000, ml: 1 } : { xp: Math.round(r * 9000) }
      )
    } else if (r < account.owned + account.lost) {
      counts[relicId] = 1
    }
  })

  if (account.dust !== null) {
    counts.Currency_ExtractionPoints = account.dust
  }

  return {
    inventory: [
      {
        counts,
        entitlementMetadata,
        metadata: JSON.stringify({ EquippedVariant: account.equipped ?? 'None' }),
      },
    ],
  }
}

export function spriteHandlers(emit: Emit, mainAccountId: string) {
  const accounts: Array<FixtureAccount> = [
    { accountId: mainAccountId, displayName: 'LITileSTWHero', seed: 1, owned: 0.55, lost: 0.15, dust: 3150, equipped: 'Water_Variant_gold' },
    { accountId: 'alt-account', displayName: 'ay dast xooshhhh', seed: 2, owned: 0.3, lost: 0.2, dust: null, equipped: 'Klombo_Variant_base' },
    { accountId: 'smurf-account', displayName: 'SmurfOfTheStorm', seed: 3, owned: 0.1, lost: 0.05, dust: 420, equipped: null, error: 'Request failed with status 403' },
  ]
  const collectionOf = (accountId: string) => {
    const account = accounts.find((item) => item.accountId === accountId)

    return buildSpriteCollection(catalog, account ? inventory(account) : null, data)
  }

  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 36e5)
  const days = (count: number) => hoursAgo(count * 24).toISOString()

  let file: SpriteHistoryFile = {
    ...emptySpriteHistory(),
    catalogue: {
      knownRelicIds: Object.keys(catalog).filter((id) => !id.startsWith('Currency_')).sort(),
      firstSeen: Object.fromEntries(
        Object.keys(catalog)
          .filter((id) => !id.startsWith('Currency_'))
          .map((id) => [id, id === 'MossyFrogSprite_Variant_A' ? days(3) : id === 'FossilMealSprite_Variant_holofoil' ? days(5) : null])
      ),
    },
  }

  /*
   * Two earlier reads per account, each a step behind the current one, so
   * the log holds secured, recovered, lost, mastered and equipped events.
   */
  accounts.slice(0, 2).forEach((account) => {
    const now = snapshotFromCollection(collectionOf(account.accountId))
    const owned = Object.keys(now.relics).filter((id) => now.relics[id].status === 'owned')
    const lost = Object.keys(now.relics).filter((id) => now.relics[id].status === 'lost')
    const mastered = owned.find((id) => now.relics[id].mastered)
    const without = (snapshot: SpriteSnapshot, ids: Array<string>) => ({
      ...snapshot,
      relics: Object.fromEntries(Object.entries(snapshot.relics).filter(([id]) => !ids.includes(id))),
    })
    const middle: SpriteSnapshot = {
      ...without(now, owned.slice(0, 1)),
      dust: now.dust === null ? null : now.dust - 300,
    }

    middle.relics = { ...middle.relics, [owned[1]]: { status: 'lost', xp: null, mastered: false } }
    if (lost[0]) middle.relics[lost[0]] = { status: 'owned', xp: 400, mastered: false }

    const start: SpriteSnapshot = {
      ...without(middle, owned.slice(2, 4)),
      dust: middle.dust === null ? null : middle.dust - 900,
      equippedRelicId: owned[5] ?? null,
    }

    if (mastered) start.relics = { ...start.relics, [mastered]: { ...now.relics[mastered], mastered: false } }

    file = recordSnapshot(file, account.accountId, start, hoursAgo(72 + account.seed)).file
    file = recordSnapshot(file, account.accountId, middle, hoursAgo(26 + account.seed)).file
    file = recordSnapshot(file, account.accountId, now, hoursAgo(account.seed)).file
  })

  const catalogue = () =>
    catalogueStatus(file.catalogue, {
      version: 13,
      versionNote: new URLSearchParams(location.search).has('sprite-version-note')
        ? 'Epic moved the sprite catalogue to version 15; Penny is following it.'
        : null,
    })
  const history = () => emit('responseSpritesHistory', buildHistoryPayload(file, catalogue(), data))

  return {
    requestSprites: (account: { accountId: string }) =>
      setTimeout(
        () =>
          emit('responseSprites', {
            accountId: account.accountId,
            collection: collectionOf(account.accountId),
            catalogue: catalogue(),
          }),
        300
      ),
    requestSpritesAll: () => {
      const sweepId = `sweep-${Date.now()}`
      const total = accounts.length

      emit('responseSpritesAll', {
        kind: 'start',
        sweepId,
        total,
        accounts: accounts.map(({ accountId, displayName }) => ({ accountId, displayName })),
      })
      accounts.forEach((account, index) =>
        setTimeout(() => {
          emit('responseSpritesAll', {
            kind: 'account',
            sweepId,
            accountId: account.accountId,
            displayName: account.displayName,
            index: index + 1,
            total,
            collection: account.error ? null : collectionOf(account.accountId),
            ...(account.error ? { errorMessage: account.error } : {}),
          })
          if (index === total - 1) {
            emit('responseSpritesAll', { kind: 'done', sweepId, total, catalogue: catalogue() })
          }
        }, 900 * (index + 1))
      )
    },
    requestSpritesHistory: () => setTimeout(history, 50),
    setSpritesWatch: (enabled: boolean, intervalMinutes?: number) => {
      file = { ...file, watch: { enabled, intervalMinutes: intervalMinutes ?? file.watch.intervalMinutes } }
      setTimeout(history, 50)
    },
  }
}
