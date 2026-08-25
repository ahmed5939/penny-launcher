import type {
  SquadAssignment,
  SquadSurvivor,
} from '../../../kernel/core/squads'

import { useEffect, useMemo, useState } from 'react'

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
  survivor: (SquadSurvivor & { name: string; power: number | null }) | null
  /**
   * Support slots only. A survivor whose personality matches the squad
   * lead's gives its full bonus; a mismatch costs you power.
   */
  matchesLead: boolean | null
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

export function useSquadsData() {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)

  const [survivors, setSurvivors] = useState<Array<SquadSurvivor>>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isAssigning, setAssigning] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  /** The slot waiting for a survivor to be picked for it. */
  const [pendingSlot, setPendingSlot] = useState<{
    squadId: string
    slotIndex: number
  } | null>(null)

  useEffect(() => {
    const listener = window.electronAPI.responseSquads(async (response) => {
      setLoading(false)
      setHasLoaded(true)
      setSurvivors(response.survivors)
      setErrorMessage(response.errorMessage ?? null)
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationSquadsAssign(
      async (response) => {
        setAssigning(false)
        setPendingSlot(null)

        toast(
          response.errorMessage
            ? `Could not move survivor: ${response.errorMessage}`
            : 'Squad updated'
        )
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const handleLoad = () => {
    if (!selected) {
      return
    }

    setLoading(true)
    window.electronAPI.requestSquads(selected)
  }

  useEffect(() => {
    if (accountId) {
      handleLoad()
    }
  }, [accountId])

  const decorated = useMemo(
    () =>
      survivors.map((survivor) => ({
        ...survivor,
        name:
          getItemRecord(records, survivor.templateId)?.name ??
          (survivor.isLead ? 'Lead Survivor' : 'Survivor'),
        power: computeItemPower({
          level: survivor.level,
          tables: ratings,
          templateId: survivor.templateId,
        }),
      })),
    [ratings, records, survivors]
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
    () =>
      decorated
        .filter((survivor) => survivor.squadId === null)
        .sort((a, b) => (b.power ?? 0) - (a.power ?? 0)),
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
    const occupant = decorated.find(
      (survivor) =>
        survivor.squadId === pendingSlot.squadId &&
        survivor.slotIndex === pendingSlot.slotIndex
    )

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

    const occupant = decorated.find(
      (survivor) =>
        survivor.squadId === squadId && survivor.slotIndex === slotIndex
    )

    if (!occupant) {
      return
    }

    setAssigning(true)
    window.electronAPI.assignSquadSurvivors(selected, [
      { characterId: occupant.itemId, squadId: '', slotIndex: -1 },
    ])
  }

  return {
    account: selected ?? null,
    candidates,
    errorMessage,
    hasLoaded,
    isAssigning,
    isLoading,
    pendingSlot,
    ratings,
    records,
    squads,
    totalFilled,
    totalPower,
    unassigned,

    handleAssign,
    handleClearSlot,
    handleLoad,
    setPendingSlot,
  }
}
