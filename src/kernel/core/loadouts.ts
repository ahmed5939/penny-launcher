import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import {
  getQueryProfile,
  setActiveHeroLoadout,
  setAssignDefenderToLoadout,
  setAssignHeroToLoadout,
  setAssignGadgetToLoadout,
  setAssignTeamPerkToLoadout,
  setAssignWeaponToDefender,
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
  /**
   * Which loadout this is in the game's own list, 1-based. The equipped one
   * is sorted to the front for the page, so its place in the array is not
   * the number the game calls it by.
   */
  position: number
  /** The one the account is currently playing. */
  active: boolean
  commander: LoadoutMember | null
  team: Array<LoadoutMember>
  /** The team perk's template id, resolved from the item it points at. */
  teamPerk: string | null
  /** The team perk item's GUID — what `AssignTeamPerkToLoadout` wants. */
  teamPerkId: string | null
  gadgets: Array<string | null>
  defenders: Array<LoadoutDefender>
}

export type LoadoutDefender = LoadoutMember & {
  alterations: Array<string>
  schematicId: string | null
  schematicTemplateId: string | null
  schematicAlterations: Array<string>
}

export type LoadoutsPayload = {
  accountId: string
  availableGadgets: Array<string>
  /** Team perks the account owns, as item GUID and template id. */
  availableTeamPerks: Array<{ itemId: string; templateId: string }>
  errorMessage?: string
  loadouts: Array<LoadoutEntry>
}

export type LoadoutEditKind =
  | 'assign'
  | 'assign-defender'
  | 'assign-defender-weapon'
  | 'assign-gadget'
  | 'assign-team-perk'
  | 'activate'
  | 'clear'
  | 'copy'

export type LoadoutEditRequest = {
  kind: LoadoutEditKind
  loadoutId: string
  /** `assign`: the hero's item GUID. */
  heroId?: string
  /** `assign`: `CommanderSlot` or `FollowerSlot1`–`FollowerSlot5`. */
  slotName?: string
  defenderId?: string
  schematicId?: string
  gadgetId?: string
  /** `assign-team-perk`: the team perk item's GUID. */
  teamPerkId?: string
  slotIndex?: number
  /** `copy`: another account's loadout, as template ids, to rebuild here. */
  copy?: LoadoutCopy
}

/**
 * A loadout lifted off one account to be rebuilt on another. Items are named
 * by template id — GUIDs are per account — and each is matched to the
 * target's own highest-level copy of the same item.
 */
export type LoadoutCopy = {
  commander: string | null
  support: Array<string | null>
  teamPerk: string | null
  gadgets: Array<string | null>
  defenders: Array<{ templateId: string | null; weapon: string | null }>
}

export type LoadoutEditNotification = {
  accountId: string
  kind: LoadoutEditKind
  errorMessage?: string
  /** `copy`: the template ids the target account does not own. */
  missing?: Array<string>
}

/** Support slots, in the order the game lays them out. */
const followerSlots = [
  'followerslot1',
  'followerslot2',
  'followerslot3',
  'followerslot4',
  'followerslot5',
]
const defenderSlots = ['defenderslot1', 'defenderslot2', 'defenderslot3']

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
          availableGadgets: [],
          availableTeamPerks: [],
          loadouts: [],
        } as LoadoutsPayload
      )
    }
  }

  private static async getLoadouts(account: AccountData) {
    const payload: LoadoutsPayload = {
      accountId: account.accountId,
      availableGadgets: [],
      availableTeamPerks: [],
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
    payload.availableGadgets = Object.values(items)
      .map((item) => item.templateId)
      .filter(
        (templateId, index, all) =>
          templateId.startsWith('Gadget:') && all.indexOf(templateId) === index
      )
    payload.availableTeamPerks = Object.entries(items)
      .filter(([, item]) => item.templateId.startsWith('TeamPerk:'))
      .map(([itemId, item]) => ({ itemId, templateId: item.templateId }))

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

    /**
     * Epic has changed the name of the defender weapon attribute between
     * profile revisions. Resolve it by ownership instead of depending only
     * on one spelling: the operation stores an item GUID, and only an owned
     * Schematic GUID can be the selected weapon.
     */
    const findOwnedSchematicId = (
      value: unknown,
      seen = new Set<unknown>()
    ): string | null => {
      if (typeof value === 'string') {
        return items[value]?.templateId?.startsWith('Schematic:')
          ? value
          : null
      }
      if (!value || typeof value !== 'object' || seen.has(value)) {
        return null
      }

      seen.add(value)
      for (const nested of Object.values(value)) {
        const schematicId = findOwnedSchematicId(nested, seen)
        if (schematicId) return schematicId
      }

      return null
    }

    const toDefender = (
      slot: string,
      itemId: unknown,
      loadoutWeapon: unknown
    ): LoadoutDefender => {
      const member = toMember(slot, itemId)
      const attributes = member.itemId
        ? ((items[member.itemId]?.attributes ?? {}) as Record<string, unknown>)
        : {}
      const schematicId = [
        attributes.weapon_schematic_id,
        attributes.assigned_weapon_schematic_id,
        attributes.assigned_schematic_id,
        attributes.weapon_schematic,
        attributes.assigned_weapon_schematic,
        attributes.defender_weapon_schematic_id,
      ].find(
        (value): value is string =>
          typeof value === 'string' &&
          items[value]?.templateId?.startsWith('Schematic:')
      ) ?? findOwnedSchematicId(attributes) ?? findOwnedSchematicId(loadoutWeapon)

      return {
        ...member,
        alterations: Array.isArray(attributes.alterations)
          ? attributes.alterations.filter(
              (value): value is string => typeof value === 'string'
            )
          : [],
        schematicId,
        schematicTemplateId: schematicId
          ? items[schematicId]?.templateId ?? null
          : null,
        schematicAlterations: schematicId
          ? (((items[schematicId]?.attributes ?? {}) as Record<string, unknown>)
              .alterations as Array<unknown> | undefined
            )?.filter((value): value is string => typeof value === 'string') ??
            []
          : [],
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
        defenders: Record<string, unknown>
        defender_slots: Record<string, unknown>
        defender_weapons: Record<string, unknown>
        defender_weapon_schematics: Record<string, unknown>
      }>
      const crew = attributes.crew_members ?? {}
      const defenders =
        attributes.defenders ?? attributes.defender_slots ?? crew
      const defenderWeapons =
        attributes.defender_weapons ??
        attributes.defender_weapon_schematics ??
        {}
      const gadgets = [0, 1].map((index) => {
        const gadget = attributes.gadgets?.[index]?.gadget
        return typeof gadget === 'string' && gadget.length > 0 ? gadget : null
      })

      gadgets.forEach((gadget) => {
        if (gadget && !payload.availableGadgets.includes(gadget)) {
          payload.availableGadgets.push(gadget)
        }
      })

      payload.loadouts.push({
        itemId,
        name: attributes.loadout_name ?? null,
        position: payload.loadouts.length + 1,
        active: itemId === selected,
        commander: toMember('commanderslot', crew.commanderslot),
        team: followerSlots.map((slot) => toMember(slot, crew[slot])),
        /*
         * The profile stores the team perk as the GUID of a TeamPerk item,
         * not as its template id; an older shape may hold the id itself.
         */
        teamPerk: attributes.team_perk
          ? (items[attributes.team_perk]?.templateId ??
            (attributes.team_perk.includes(':') ? attributes.team_perk : null))
          : null,
        teamPerkId:
          attributes.team_perk && items[attributes.team_perk]
            ? attributes.team_perk
            : null,
        gadgets,
        defenders: defenderSlots.map((slot) =>
          toDefender(slot, defenders[slot], defenderWeapons[slot])
        ),
      })
    })

    /** The one you are playing first; the rest keep their profile order. */
    payload.loadouts.sort(
      (loadoutA, loadoutB) => Number(loadoutB.active) - Number(loadoutA.active)
    )

    return payload
  }

  /**
   * Rebuilds a loadout from another account's copy: empties it, then fills
   * every seat, the team perk, gadgets and defenders with this account's own
   * best copy of each item. What the account does not own is left empty and
   * returned, so the page can say so.
   */
  private static async applyCopy(
    accountId: string,
    accessToken: string,
    loadoutId: string,
    copy: LoadoutCopy
  ) {
    const response = await getQueryProfile({ accessToken, accountId })
    const items = response.data.profileChanges[0]?.profile?.items ?? {}
    const missing: Array<string> = []
    const used = new Set<string>()

    /** This account's highest-level copy of a template, not yet placed. */
    const own = (templateId: string | null) => {
      if (!templateId) return null
      const wanted = templateId.toLowerCase()
      const match = Object.entries(items)
        .filter(([itemId, item]) => item.templateId.toLowerCase() === wanted && !used.has(itemId))
        .sort(
          ([, a], [, b]) =>
            (((b.attributes as Record<string, unknown>)?.level as number) ?? 0) -
            (((a.attributes as Record<string, unknown>)?.level as number) ?? 0)
        )[0]

      if (!match) {
        missing.push(templateId)
        return null
      }
      used.add(match[0])
      return match[0]
    }

    await setClearHeroLoadout({ accessToken, accountId, loadoutId })

    const heroes: Array<[string, string | null]> = [
      ['CommanderSlot', copy.commander],
      ...copy.support.map((templateId, index): [string, string | null] => [`FollowerSlot${index + 1}`, templateId]),
    ]

    for (const [slotName, templateId] of heroes) {
      const heroId = own(templateId)
      if (heroId) await setAssignHeroToLoadout({ accessToken, accountId, heroId, loadoutId, slotName })
    }

    const teamPerkId = own(copy.teamPerk)
    if (teamPerkId) await setAssignTeamPerkToLoadout({ accessToken, accountId, loadoutId, teamPerkId })

    for (const [slotIndex, gadgetId] of copy.gadgets.entries()) {
      /* Gadgets are assigned by template id and only need to be unlocked. */
      if (!gadgetId) continue
      const owned = Object.values(items).some((item) => item.templateId.toLowerCase() === gadgetId.toLowerCase())
      if (!owned) {
        missing.push(gadgetId)
        continue
      }
      await setAssignGadgetToLoadout({ accessToken, accountId, gadgetId, loadoutId, slotIndex })
    }

    for (const [index, defender] of copy.defenders.entries()) {
      const defenderId = own(defender.templateId)
      if (!defenderId) continue
      await setAssignDefenderToLoadout({ accessToken, accountId, defenderId, loadoutId, slotName: `DefenderSlot${index + 1}` })
      const weaponSchematicId = own(defender.weapon)
      if (weaponSchematicId) await setAssignWeaponToDefender({ accessToken, accountId, defenderId, weaponSchematicId })
    }

    return missing
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
      } else if (request.kind === 'assign-defender') {
        if (!request.defenderId || !request.slotName) {
          throw new Error('No defender or slot was given')
        }
        await setAssignDefenderToLoadout({
          accessToken,
          accountId: account.accountId,
          defenderId: request.defenderId,
          loadoutId: request.loadoutId,
          slotName: request.slotName,
        })
      } else if (request.kind === 'assign-defender-weapon') {
        if (!request.defenderId || request.schematicId === undefined) {
          throw new Error('No defender or schematic was given')
        }
        await setAssignWeaponToDefender({
          accessToken,
          accountId: account.accountId,
          defenderId: request.defenderId,
          weaponSchematicId: request.schematicId,
        })
      } else if (request.kind === 'assign-gadget') {
        if (
          request.gadgetId === undefined ||
          request.slotIndex === undefined
        ) {
          throw new Error('No gadget or slot was given')
        }
        await setAssignGadgetToLoadout({
          accessToken,
          accountId: account.accountId,
          gadgetId: request.gadgetId,
          loadoutId: request.loadoutId,
          slotIndex: request.slotIndex,
        })
      } else if (request.kind === 'assign-team-perk') {
        if (!request.teamPerkId) {
          throw new Error('No team perk was given')
        }
        await setAssignTeamPerkToLoadout({
          accessToken,
          accountId: account.accountId,
          loadoutId: request.loadoutId,
          teamPerkId: request.teamPerkId,
        })
      } else if (request.kind === 'copy') {
        if (!request.copy) {
          throw new Error('No loadout was given to copy')
        }
        notification.missing = await Loadouts.applyCopy(
          account.accountId,
          accessToken,
          request.loadoutId,
          request.copy
        )
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
