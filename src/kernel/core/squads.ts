import type { AccountData } from '../../types/accounts'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import { prettifyWorkerTrait } from '../../config/constants/fortnite/items'
import { survivorSquads } from '../../config/constants/fortnite/squads'

import {
  getQueryProfile,
  setAssignWorkerToSquadBatch,
} from '../../services/endpoints/mcp'

export type SquadAssignment = {
  /** Survivor item GUID. */
  characterId: string
  squadId: string
  /** 0 is the squad leader, 1–7 the support slots. */
  slotIndex: number
}

export type SquadSurvivor = {
  itemId: string
  templateId: string
  level: number
  /** Null when the survivor is sitting unassigned in the vault. */
  squadId: string | null
  slotIndex: number
  /** "Analytical", "Dependable" … */
  personality: string | null
  setBonus: string | null
  /** Lead survivors only — the squad type they belong in. */
  managerSynergy: string | null
  isLead: boolean
  /**
   * `WorkerPortrait:` template id — the face the game rolled for this copy.
   * Resolvable against the item database, and the only thing that tells one
   * unnamed survivor apart from another.
   */
  portrait: string | null
}

export type SquadsPayload = {
  accountId: string
  errorMessage?: string
  /** Every survivor the account owns, assigned or not. */
  survivors: Array<SquadSurvivor>
}

export type SquadsAssignNotification = {
  accountId: string
  assigned: number
  errorMessage?: string
}

const knownSquadIds = new Map(
  survivorSquads.map((squad) => [squad.id.toLowerCase(), squad.id])
)

/**
 * Survivor squad management.
 *
 * This replaces the old "squad presets" feature, which captured a layout as
 * a list of survivor item GUIDs and then replayed that list against other
 * accounts. Item GUIDs are per-account, so the replay could only ever be a
 * no-op or an error on any account but the one it was captured from.
 */
export class Squads {
  static async request(account: AccountData) {
    try {
      const payload = await Squads.getSurvivors(account)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.SquadsResponse,
        payload
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.SquadsResponse,
        {
          accountId: account.accountId,
          errorMessage:
            error?.response?.data?.errorMessage ?? 'Unknown Error',
          survivors: [],
        } as SquadsPayload
      )
    }
  }

  private static async getSurvivors(account: AccountData) {
    const payload: SquadsPayload = {
      accountId: account.accountId,
      survivors: [],
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
    const items = response.data.profileChanges[0]?.profile.items ?? {}

    Object.entries(items).forEach(([itemId, item]) => {
      if (!item.templateId.startsWith('Worker:')) {
        return
      }

      const attributes = (item.attributes ?? {}) as Partial<{
        level: number
        managerSynergy: string
        personality: string
        portrait: string
        set_bonus: string
        squad_id: string
        squad_slot_idx: number
      }>
      const rawSquadId = attributes.squad_id ?? ''

      /**
       * Heroes use the same squad mechanism for their own loadouts, so an
       * unrecognised squad id means this worker is not a survivor slot.
       */
      // Profile squad ids are not consistently cased. Keep the canonical id
      // after a case-insensitive match so it maps to the correct card.
      const squadId = rawSquadId
        ? (knownSquadIds.get(rawSquadId.toLowerCase()) ?? null)
        : null

      payload.survivors.push({
        itemId,
        templateId: item.templateId,
        level: attributes.level ?? 1,
        squadId,
        slotIndex: squadId ? (attributes.squad_slot_idx ?? 0) : -1,
        personality: prettifyWorkerTrait(attributes.personality),
        setBonus: prettifyWorkerTrait(attributes.set_bonus),
        managerSynergy: prettifyWorkerTrait(attributes.managerSynergy),
        isLead: item.templateId.toLowerCase().includes('manager'),
        portrait: attributes.portrait ?? null,
      })
    })

    return payload
  }

  /**
   * Moves survivors between slots. Epic takes the three arrays positionally,
   * and one batch keeps the whole rearrangement to a single profile
   * revision.
   */
  static async assign(
    account: AccountData,
    assignments: Array<SquadAssignment>
  ) {
    const notification: SquadsAssignNotification = {
      accountId: account.accountId,
      assigned: 0,
    }

    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        notification.errorMessage = 'Unknown Error'
      } else if (assignments.length > 0) {
        await setAssignWorkerToSquadBatch({
          accessToken,
          accountId: account.accountId,
          characterIds: assignments.map((item) => item.characterId),
          squadIds: assignments.map((item) => item.squadId),
          slotIndices: assignments.map((item) => item.slotIndex),
        })

        notification.assigned = assignments.length
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      notification.errorMessage =
        error?.response?.data?.errorMessage ?? 'Unknown Error'
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.SquadsAssignNotification,
      notification
    )

    await Squads.request(account)
  }
}
