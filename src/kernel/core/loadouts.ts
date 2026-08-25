import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import {
  getQueryProfile,
  setActiveHeroLoadout,
  setAssignHeroToLoadout,
  setClearHeroLoadout,
} from '../../services/endpoints/mcp'

export type LoadoutMember = {
  /** `commanderslot`, `followerslot1` … */
  slot: string
  /** Item GUID of the hero in that slot, when one is assigned. */
  itemId: string | null
  /** Resolved from the hero item, so the renderer can name and draw it. */
  templateId: string | null
  level: number
  tier: number
}

export type LoadoutEntry = {
  itemId: string
  name: string | null
  /** The one the account is currently playing. */
  active: boolean
  commander: LoadoutMember | null
  team: Array<LoadoutMember>
  teamPerk: string | null
  gadgets: Array<string>
}

export type LoadoutsPayload = {
  accountId: string
  errorMessage?: string
  loadouts: Array<LoadoutEntry>
}

export type LoadoutEditKind = 'assign' | 'activate' | 'clear'

export type LoadoutEditRequest = {
  kind: LoadoutEditKind
  loadoutId: string
  /** `assign`: the hero's item GUID. */
  heroId?: string
  /** `assign`: `CommanderSlot` or `FollowerSlot1`–`FollowerSlot5`. */
  slotName?: string
}

export type LoadoutEditNotification = {
  accountId: string
  kind: LoadoutEditKind
  errorMessage?: string
}

/** Support slots, in the order the game lays them out. */
const followerSlots = [
  'followerslot1',
  'followerslot2',
  'followerslot3',
  'followerslot4',
  'followerslot5',
]

/**
 * The profile stores crew keys lowercased, but `AssignHeroToLoadout` wants
 * them cased — `followerslot2` on the way in, `FollowerSlot2` on the way
 * out.
 */
export function loadoutSlotName(slot: string) {
  if (slot === 'commanderslot') {
    return 'CommanderSlot'
  }

  const match = /^followerslot(\d)$/.exec(slot)

  return match ? `FollowerSlot${match[1]}` : slot
}

export class Loadouts {
  static async request(account: AccountData) {
    try {
      const payload = await Loadouts.getLoadouts(account)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.LoadoutsResponse,
        payload
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.LoadoutsResponse,
        {
          accountId: account.accountId,
          errorMessage:
            error?.response?.data?.errorMessage ?? 'Unknown Error',
          loadouts: [],
        } as LoadoutsPayload
      )
    }
  }

  private static async getLoadouts(account: AccountData) {
    const payload: LoadoutsPayload = {
      accountId: account.accountId,
      loadouts: [],
    }
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      payload.errorMessage = 'Unknown Error'

      return payload
    }

    const response = await getQueryProfile({
      accessToken,
      accountId: account.accountId,
    })
    const profile = response.data.profileChanges[0]?.profile
    const items = profile?.items ?? {}
    const selected = profile?.stats?.attributes?.selected_hero_loadout ?? null

    /**
     * Loadouts only store hero *item ids*, so every slot has to be looked
     * back up in the same item map to find out which hero it actually is.
     */
    const heroById = (itemId: string) => {
      const hero = items[itemId as keyof typeof items] as
        | { attributes?: Record<string, unknown>; templateId?: string }
        | undefined

      if (!hero?.templateId) {
        return null
      }

      const tierMatch = /_t(\d+)/.exec(hero.templateId.toLowerCase())

      return {
        templateId: hero.templateId,
        level: (hero.attributes?.level as number) ?? 1,
        tier: tierMatch ? Number(tierMatch[1]) : 0,
      }
    }

    const toMember = (slot: string, itemId: unknown): LoadoutMember => {
      const id = typeof itemId === 'string' && itemId.length > 0 ? itemId : null
      const hero = id ? heroById(id) : null

      return {
        slot,
        itemId: id,
        templateId: hero?.templateId ?? null,
        level: hero?.level ?? 0,
        tier: hero?.tier ?? 0,
      }
    }

    Object.entries(items).forEach(([itemId, item]) => {
      if (!item.templateId.startsWith('CampaignHeroLoadout:')) {
        return
      }

      const attributes = (item.attributes ?? {}) as Partial<{
        crew_members: Record<string, unknown>
        gadgets: Array<{ gadget?: string }>
        loadout_name: string
        team_perk: string
      }>
      const crew = attributes.crew_members ?? {}

      payload.loadouts.push({
        itemId,
        name: attributes.loadout_name ?? null,
        active: itemId === selected,
        commander: toMember('commanderslot', crew.commanderslot),
        team: followerSlots.map((slot) => toMember(slot, crew[slot])),
        teamPerk: attributes.team_perk ?? null,
        gadgets: (attributes.gadgets ?? [])
          .map((entry) => entry?.gadget)
          .filter((gadget): gadget is string => typeof gadget === 'string'),
      })
    })

    /** The one you are playing first; the rest keep their profile order. */
    payload.loadouts.sort(
      (loadoutA, loadoutB) => Number(loadoutB.active) - Number(loadoutA.active)
    )

    return payload
  }

  /**
   * Slots a hero, switches the active loadout, or empties one. Reloads
   * afterwards so the page reflects what Epic actually stored rather than
   * what was asked for.
   */
  static async edit(account: AccountData, request: LoadoutEditRequest) {
    const notification: LoadoutEditNotification = {
      accountId: account.accountId,
      kind: request.kind,
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        notification.errorMessage = 'Unknown Error'
      } else if (request.kind === 'assign') {
        if (!request.heroId || !request.slotName) {
          throw new Error('No hero or slot was given')
        }

        await setAssignHeroToLoadout({
          accessToken,
          accountId: account.accountId,
          heroId: request.heroId,
          loadoutId: request.loadoutId,
          slotName: request.slotName,
        })
      } else if (request.kind === 'activate') {
        await setActiveHeroLoadout({
          accessToken,
          accountId: account.accountId,
          selectedLoadout: request.loadoutId,
        })
      } else {
        await setClearHeroLoadout({
          accessToken,
          accountId: account.accountId,
          loadoutId: request.loadoutId,
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      notification.errorMessage =
        error?.response?.data?.errorMessage ?? 'Unknown Error'
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.LoadoutEditNotification,
      notification
    )

    await Loadouts.request(account)
  }
}
