import { RuntimeLog } from '../runtime-log'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import axios from 'axios'

import type { RatingTables } from '../../config/constants/fortnite/power'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import {
  peglegNamedItemFiles,
  peglegResourcesBaseURL,
} from '../../config/constants/pegleg'

import { DataDirectory } from '../startup/data-directory'
import { MainWindow } from '../startup/windows/main'

/**
 * The game's own item data, cached on disk.
 *
 * Bump when the narrowed shape changes — an older cache is then discarded
 * rather than being read back into a record the renderer cannot use.
 */
const cacheVersion = 8

/** Re-download roughly weekly; the source only moves when Fortnite patches. */
const cacheMaxAgeMs = 7 * 24 * 60 * 60 * 1000

export type ItemRecordPerk = {
  name: string
  description: string | null
}

export type ItemRecord = {
  /** In-game display name, e.g. "Scrapper Spear". */
  name: string
  /** "Spear", "Constructor", "Martial Artist" … */
  subType: string | null
  description: string | null
  /** Display rarity — "Legendary" where the template id says `_sr_`. */
  rarity: string | null
  tier: number
  /** `ExportedImages` file name, resolved through `peglegImageURL`. */
  image: string | null
  /** The bigger art, for detail views. */
  largeImage: string | null
  /** Schematics: "Melee", "Ranged", "Trap". */
  category: string | null
  /** Schematics: "Copper", "Silver", "Malachite" … — the material tier. */
  displayTier: string | null
  /** What recycling this item hands back. */
  recycle: { amount: number; result: string } | null
  /** Heroes. */
  perk: ItemRecordPerk | null
  commanderPerk: ItemRecordPerk | null
  perkTemplate: string | null
  commanderPerkTemplate: string | null
  /** Hero ability template ids, resolvable against this same map. */
  abilities: Array<string>
  /** What crafting one costs, by resource template id. */
  craftingCost: Record<string, number>
  /** What evolving to the next tier costs. */
  tierUpCost: Record<string, number>
  /**
   * Quests only. `backendName` is what the profile counts against, as
   * `completion_<backendName>`.
   */
  objectives: Array<{
    backendName: string
    count: number
    description: string | null
  }>
  /** Quests only. */
  rewards: Array<{ item: string; quantity: number }>
  /**
   * What raising this to the next rarity costs — the perk-upgrade cost for
   * alterations, the evolution cost for heroes and survivors.
   */
  upgradeCost: Record<string, number>
  /** What it becomes. */
  upgradeResult: string | null
  /**
   * Schematics: which perk-pool row this item draws from. Look it up in
   * `ItemDatabasePayload.alterationPools` to find what each perk slot may
   * legally hold.
   */
  alterationRow: string | null
}

/** One perk slot's legal contents, from `AlterationLoadouts`. */
export type AlterationSlotPool = {
  /** `Alteration:` template ids this slot may hold. */
  options: Array<string>
  /** What swapping this slot's perk costs. */
  respecCost: Record<string, number>
  requiredLevel: number
  requiredRarity: string | null
}

export type ItemRecordMap = Record<string, ItemRecord>

export type ItemDatabasePayload = {
  errorMessage?: string
  fetchedAt: string | null
  records: ItemRecordMap
  /** Level → power-level curves, keyed by rarity and tier. */
  ratings: RatingTables
  /** Perk-pool row → one entry per perk slot. */
  alterationPools: Record<string, Array<AlterationSlotPool>>
  total: number
}

type RawNamedItem = Partial<{
  Category: string
  CommanderPerk: string
  CommanderPerkDescription: string
  CraftingCost: Record<string, number>
  Description: string
  DisplayName: string
  AlterationLoadoutRow: string
  DisplayTier: string
  HeroAbilities: Array<string>
  HeroPerk: string
  HeroPerkDescription: string
  HeroPerkTemplate: string
  CommanderPerkTemplate: string
  ImagePaths: Partial<{
    Icon: string
    LargePreview: string
    SmallPreview: string
  }>
  Objectives: Array<
    Partial<{ BackendName: string; Count: number; Description: string }>
  >
  Rarity: string
  RarityUpRecipe: Partial<{
    Cost: Record<string, number>
    Result: string
  }>
  Rewards: Array<
    Partial<{ Hidden: boolean; Item: string; Quantity: number }>
  >
  RecycleRecipe: Partial<{ Amount: number; Result: string }>
  SubType: string
  Tier: number
  TierUpRecipe: Partial<{ Cost: Record<string, number>; Result: string }>
}>

function fileName(value: string | undefined) {
  return typeof value === 'string' ? (value.split(/[\\/]/).pop() ?? null) : null
}

function perk(
  name: string | undefined,
  description: string | undefined
): ItemRecordPerk | null {
  return name ? { name, description: description ?? null } : null
}

export class ItemDatabase {
  private static cache: ItemDatabasePayload | null = null

  private static get filePath() {
    return path.join(
      DataDirectory.getDataDirectoryPath(),
      'pegleg-items.json'
    )
  }

  /**
   * Hands the renderer whatever is on disk, downloading first if there is
   * nothing usable. Never rejects: without this data the app falls back to
   * decoded template ids, which is worse but still works.
   */
  static async request(force = false) {
    try {
      const payload = await ItemDatabase.load(force)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ItemDatabaseResponse,
        payload
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ItemDatabaseResponse,
        {
          errorMessage: error?.message ?? 'Unknown Error',
          alterationPools: {},
          fetchedAt: null,
          records: {},
          ratings: {},
          total: 0,
        } as ItemDatabasePayload
      )
    }
  }

  private static async load(force: boolean) {
    if (!force && ItemDatabase.cache) {
      return ItemDatabase.cache
    }

    if (!force) {
      const cached = await ItemDatabase.readCache()

      if (cached) {
        ItemDatabase.cache = cached

        return cached
      }
    }

    const payload = await ItemDatabase.download()

    ItemDatabase.cache = payload

    await ItemDatabase.writeCache(payload)

    return payload
  }

  private static async readCache() {
    try {
      const raw = await readFile(ItemDatabase.filePath, 'utf8')
      const parsed = JSON.parse(raw) as {
        alterationPools?: Record<string, Array<AlterationSlotPool>>
        fetchedAt?: string
        ratings?: RatingTables
        records?: ItemRecordMap
        version?: number
      }

      if (
        parsed.version !== cacheVersion ||
        !parsed.records ||
        !parsed.fetchedAt
      ) {
        return null
      }

      const age = Date.now() - new Date(parsed.fetchedAt).getTime()

      if (Number.isNaN(age) || age > cacheMaxAgeMs) {
        return null
      }

      return {
        fetchedAt: parsed.fetchedAt,
        alterationPools: parsed.alterationPools ?? {},
        records: parsed.records,
        ratings: parsed.ratings ?? {},
        total: Object.keys(parsed.records).length,
      } as ItemDatabasePayload

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return null
    }
  }

  private static async writeCache(payload: ItemDatabasePayload) {
    try {
      await mkdir(DataDirectory.getDataDirectoryPath(), { recursive: true })
      await writeFile(
        ItemDatabase.filePath,
        JSON.stringify({
          version: cacheVersion,
          alterationPools: payload.alterationPools,
          fetchedAt: payload.fetchedAt,
          ratings: payload.ratings,
          records: payload.records,
        }),
        { encoding: 'utf8' }
      )

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/item-database.ts', error)
    }
  }

  /**
   * Downloads each family in turn and narrows it. A family that fails is
   * skipped rather than failing the whole set — a missing `Gadget.json`
   * should not cost you every schematic name.
   */
  private static async download() {
    const records: ItemRecordMap = {}
    const alterationPools: Record<string, Array<AlterationSlotPool>> = {}
    let ratings: RatingTables = {}

    /**
     * The perk pools say which perks a given schematic's slots may legally
     * hold, and what swapping one costs — without them "change perk" would
     * be a free-text guess at a template id.
     */
    const poolsRequest = axios
      .get<
        Record<
          string,
          Array<{
            BaseRespecCost?: Record<string, number>
            RawAlterations?: Array<{ AID?: string }>
            RequiredLevel?: number
            RequiredRarity?: string
          }>
        >
      >(`${peglegResourcesBaseURL}/GameAssets/AlterationLoadouts.json`, {
        responseType: 'json',
        timeout: 60_000,
      })
      .then((response) => {
        Object.entries(response.data).forEach(([row, slots]) => {
          alterationPools[row] = (slots ?? []).map((slot) => ({
            options: (slot.RawAlterations ?? [])
              .map((entry) => entry.AID)
              .filter((aid): aid is string => typeof aid === 'string'),
            respecCost: slot.BaseRespecCost ?? {},
            requiredLevel: slot.RequiredLevel ?? 0,
            requiredRarity: slot.RequiredRarity ?? null,
          }))
        })
      })
      .catch(() => {
        /** Perk swapping simply stays unavailable. */
      })

    /**
     * The power-level curves are one small file and are what turns "tier 4,
     * level 31" into the number the game shows, so they come down with the
     * item data rather than on demand.
     */
    const ratingsRequest = axios
      .get<RatingTables>(
        `${peglegResourcesBaseURL}/GameAssets/ItemRatings.json`,
        { responseType: 'json', timeout: 60_000 }
      )
      .then((response) => {
        ratings = response.data
      })
      .catch(() => {
        /** Power falls back to "unknown" rather than failing the download. */
      })

    await Promise.allSettled(
      peglegNamedItemFiles.map(async (family) => {
        const response = await axios.get<Record<string, RawNamedItem>>(
          `${peglegResourcesBaseURL}/GameAssets/NamedItems/${family}.json`,
          { responseType: 'json', timeout: 60_000 }
        )

        Object.entries(response.data).forEach(([templateId, item]) => {
          if (!item?.DisplayName) {
            return
          }

          records[templateId.toLowerCase()] = {
            name: item.DisplayName,
            subType: item.SubType ?? null,
            description: item.Description ?? null,
            rarity: item.Rarity ?? null,
            tier: item.Tier ?? 0,
            image:
              fileName(item.ImagePaths?.SmallPreview) ??
              fileName(item.ImagePaths?.LargePreview) ??
              fileName(item.ImagePaths?.Icon),
            largeImage:
              fileName(item.ImagePaths?.LargePreview) ??
              fileName(item.ImagePaths?.SmallPreview),
            category: item.Category ?? null,
            displayTier: item.DisplayTier ?? null,
            recycle: item.RecycleRecipe?.Result
              ? {
                  amount: item.RecycleRecipe.Amount ?? 0,
                  result: item.RecycleRecipe.Result,
                }
              : null,
            perk: perk(item.HeroPerk, item.HeroPerkDescription),
            commanderPerk: perk(
              item.CommanderPerk,
              item.CommanderPerkDescription
            ),
            perkTemplate: item.HeroPerkTemplate ?? null,
            commanderPerkTemplate: item.CommanderPerkTemplate ?? null,
            abilities: item.HeroAbilities ?? [],
            craftingCost: item.CraftingCost ?? {},
            tierUpCost: item.TierUpRecipe?.Cost ?? {},
            objectives: (item.Objectives ?? [])
              .filter((objective) => objective.BackendName)
              .map((objective) => ({
                backendName: objective.BackendName as string,
                count: objective.Count ?? 1,
                description: objective.Description ?? null,
              })),
            rewards: (item.Rewards ?? [])
              .filter((reward) => reward.Item && reward.Hidden !== true)
              .map((reward) => ({
                item: reward.Item as string,
                quantity: reward.Quantity ?? 1,
              })),
            upgradeCost: item.RarityUpRecipe?.Cost ?? {},
            upgradeResult: item.RarityUpRecipe?.Result ?? null,
            alterationRow: item.AlterationLoadoutRow ?? null,
          }
        })
      })
    )

    await Promise.all([ratingsRequest, poolsRequest])

    if (Object.keys(records).length <= 0) {
      throw new Error('Could not download the item database')
    }

    return {
      alterationPools,
      fetchedAt: new Date().toISOString(),
      records,
      ratings,
      total: Object.keys(records).length,
    } as ItemDatabasePayload
  }
}
