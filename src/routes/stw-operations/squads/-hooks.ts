import type {
  SquadAssignment,
  SquadSurvivor,
  SquadsPayload,
} from '../../../kernel/core/squads'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAccountResource } from '../../../components/page'

import { useAccountListStore } from '../../../state/accounts/list'
import {
  getItemRecord,
  useItemDatabaseStore,
} from '../../../state/items/database'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { computeItemPower } from '../../../config/constants/fortnite/power'
import {
  squadSlotCount,
  survivorSquads,
} from '../../../config/constants/fortnite/squads'

import { toast } from '../../../lib/notifications'

export type SquadSlotView = {
  slotIndex: number
  survivor: DecoratedSurvivor | null
  /**
   * Support slots only. A survivor whose personality matches the squad
   * lead's gives its full bonus; a mismatch costs you power.
   */
  matchesLead: boolean | null
}

export type DecoratedSurvivor = SquadSurvivor & {
  name: string
  /**
   * The second line on a tile. For a rank-and-file survivor — whose name is
   * just "Survivor" — the name is its personality and this is its set bonus,
   * which is what the game's own squad screen tells them apart by.
   */
  caption: string | null
  power: number | null
}

/** "Trap Durability High" → "Trap Durability": the tier is noise on a tile. */
function shortSetBonus(setBonus: string | null) {
  return setBonus?.replace(/\s+(Low|High)$/i, '') ?? null
}

/**
 * The name the game would show. Unique survivors and leads with a database
 * name keep it; generic ones are named by what distinguishes them — a lead
 * by its role ("Doctor"), a survivor by its personality ("Analytical").
 */
export function survivorLabels(
  survivor: SquadSurvivor,
  recordName: string | undefined
) {
  const generic = !recordName || /^(lead )?survivor$/i.test(recordName.trim())

  if (survivor.isLead) {
    return {
      name: generic
        ? (survivor.managerSynergy ?? 'Lead survivor')
        : (recordName as string),
      caption: survivor.personality,
    }
  }

  return generic
    ? {
        name: survivor.personality ?? 'Survivor',
        caption: shortSetBonus(survivor.setBonus),
      }
    : { name: recordName as string, caption: survivor.personality }
}

export type SquadView = {
  id: string
  label: string
  attribute: string
  slots: Array<SquadSlotView>
  /** Summed power of everyone in the squad. */
  power: number
  filled: number
}

export type PendingSlot = { squadId: string; slotIndex: number }

/** How long a follow-up waits for the reply the main process sends by itself. */
const followTimeoutMs = 15_000

/**
 * The squads IPC is fire-and-forget: a request goes out, the payload comes
 * back on its own channel. This turns one round trip into a promise for
 * `useAccountResource`.
 *
 * `follow` skips the request and waits for the reply the main process
 * already sends after an assignment, so a move costs one profile read rather
 * than two. If that reply never shows, it asks after all.
 */
function readSquads(accountId: string, follow: boolean) {
  const account = useAccountListStore.getState().accounts[accountId]

  if (!account) {
    return Promise.reject(
      new Error('This account is no longer in the launcher. Choose another.')
    )
  }

  return new Promise<SquadsPayload>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const listener = window.electronAPI.responseSquads(async (response) => {
      if (response.accountId !== accountId) {
        return
      }

      clearTimeout(timer)
      listener.removeListener()

      if (response.errorMessage) {
        reject(
          new Error(
            `Could not read the squads (${response.errorMessage}). Try Refresh.`
          )
        )
      } else {
        resolve(response)
      }
    })

    if (follow) {
      timer = setTimeout(
        () => window.electronAPI.requestSquads(account),
        followTimeoutMs
      )
    } else {
      window.electronAPI.requestSquads(account)
    }
  })
}

export function useSquadsResource() {
  const followNext = useRef(false)
  const resource = useAccountResource(
    (accountId) => {
      const follow = followNext.current
      followNext.current = false

      return readSquads(accountId, follow)
    },
    {
      cacheKey: 'stw.squads',
      fallbackError: 'Could not read the squads. Try Refresh.',
      owner: (result) => result.accountId,
    }
  )
  const { refresh } = resource

  /** Pick up the fresh squads the main process sends after an assignment. */
  const followUp = useCallback(() => {
    followNext.current = true
    refresh()
  }, [refresh])

  return { followUp, resource }
}

/**
 * Everything the squads view does with one account's payload. Lives in the
 * child keyed by account id, so the open picker and the busy flag reset on
 * an account switch without any reset code.
 */
export function useSquads(payload: SquadsPayload, onAssigned: () => void) {
  const { selected } = useGetSelectedAccount()

  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)

  const [isAssigning, setAssigning] = useState(false)
  /** The slot waiting for a survivor to be picked for it. */
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null)

  useEffect(() => {
    const listener = window.electronAPI.notificationSquadsAssign(
      async (response) => {
        if (response.accountId !== payload.accountId) {
          return
        }

        setAssigning(false)
        setPendingSlot(null)

        toast[response.errorMessage ? 'error' : 'success'](
          response.errorMessage
            ? `Could not move survivor: ${response.errorMessage}`
            : 'Squad updated'
        )

        onAssigned()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [onAssigned, payload.accountId])

  const decorated: Array<DecoratedSurvivor> = useMemo(
    () =>
      payload.survivors.map((survivor) => ({
        ...survivor,
        ...survivorLabels(
          survivor,
          getItemRecord(records, survivor.templateId)?.name
        ),
        power: computeItemPower({
          level: survivor.level,
          tables: ratings,
          templateId: survivor.templateId,
        }),
      })),
    [payload, ratings, records]
  )

  const squads: Array<SquadView> = useMemo(
    () =>
      survivorSquads.map((squad) => {
        const members = decorated.filter(
          (survivor) => survivor.squadId === squad.id
        )
        const lead = members.find((survivor) => survivor.slotIndex === 0)

        const slots: Array<SquadSlotView> = Array.from(
          { length: squadSlotCount },
          (_, slotIndex) => {
            const survivor =
              members.find((item) => item.slotIndex === slotIndex) ?? null

            return {
              slotIndex,
              survivor,
              matchesLead:
                slotIndex === 0 || !survivor || !lead?.personality
                  ? null
                  : survivor.personality === lead.personality,
            }
          }
        )

        return {
          id: squad.id,
          label: squad.label,
          attribute: squad.attribute,
          slots,
          filled: members.length,
          power: members.reduce(
            (accumulator, survivor) => accumulator + (survivor.power ?? 0),
            0
          ),
        }
      }),
    [decorated]
  )

  const unassigned = useMemo(
    () => decorated.filter((survivor) => survivor.squadId === null),
    [decorated]
  )

  /** Only survivors that can legally go in the pending slot. */
  const candidates = useMemo(() => {
    if (!pendingSlot) {
      return []
    }

    const wantsLead = pendingSlot.slotIndex === 0

    return decorated
      .filter((survivor) => survivor.isLead === wantsLead)
      .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))
  }, [decorated, pendingSlot])

  /** Whoever currently holds the pending slot, for the picker's header. */
  const occupant = useMemo(
    () =>
      pendingSlot
        ? (decorated.find(
            (survivor) =>
              survivor.squadId === pendingSlot.squadId &&
              survivor.slotIndex === pendingSlot.slotIndex
          ) ?? null)
        : null,
    [decorated, pendingSlot]
  )

  const totalPower = squads.reduce(
    (accumulator, squad) => accumulator + squad.power,
    0
  )
  const totalFilled = squads.reduce(
    (accumulator, squad) => accumulator + squad.filled,
    0
  )

  const handleAssign = (characterId: string) => {
    if (!selected || !pendingSlot || isAssigning) {
      return
    }

    const assignments: Array<SquadAssignment> = [
      {
        characterId,
        squadId: pendingSlot.squadId,
        slotIndex: pendingSlot.slotIndex,
      },
    ]

    /**
     * Moving someone who is already slotted would leave them in two places,
     * so whoever currently holds the target slot is pushed out first — one
     * batch, so the profile only takes a single revision.
     */
    if (occupant && occupant.itemId !== characterId) {
      assignments.unshift({
        characterId: occupant.itemId,
        squadId: '',
        slotIndex: -1,
      })
    }

    setAssigning(true)
    window.electronAPI.assignSquadSurvivors(selected, assignments)
  }

  const handleClearSlot = (squadId: string, slotIndex: number) => {
    if (!selected || isAssigning) {
      return
    }

    const current = decorated.find(
      (survivor) =>
        survivor.squadId === squadId && survivor.slotIndex === slotIndex
    )

    if (!current) {
      return
    }

    setAssigning(true)
    window.electronAPI.assignSquadSurvivors(selected, [
      { characterId: current.itemId, squadId: '', slotIndex: -1 },
    ])
  }

  return {
    candidates,
    isAssigning,
    occupant,
    pendingSlot,
    records,
    squads,
    totalFilled,
    totalPower,
    unassigned,

    handleAssign,
    handleClearSlot,
    setPendingSlot,
  }
}
